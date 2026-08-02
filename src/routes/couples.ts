import express, { Request, Response } from "express";
import { transformFormData } from "../helpers/transformFormData";
import { normaliseReferenceCode } from "../helpers/referenceCode";
import { toE164 } from "../helpers/phoneNumber";
import { handleError, handleValidationError } from "../helpers/errorHandler";
import CouplesDetailsService from "../services/couplesDetails";
import CouplesService from "../services/couples";
import { get } from "lodash";
import { getIO } from "../socket";
import LessonsService from "../services/lessons";
import StorageService from "../services/storage";
import MiddlewareService from "../middleware/index";
import multer from "multer";
import { assignCounsellorMail } from "../helpers/mailTemplate";
import UsersDetailsService from "../services/users";
import { sendMail } from "../helpers/mailer";
const upload = multer({ dest: "uploads/letters/" });

const router = express.Router();

const addCouples = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    let uploadedFiles: { id: string; name: string }[] = [];

    if (request.file) {
      uploadedFiles = await StorageService.uploadFiles(
        [request.file],
        "letters"
      );
    }

    const partners = await Promise.allSettled([
      await CouplesDetailsService.createDetails({
        name: body.manName,
        phoneNumber: body.manNumber,
        gender: "male",
      }),
      await CouplesDetailsService.createDetails({
        name: body.womanName,
        phoneNumber: body.womanNumber,
        gender: "female",
      }),
    ]);

    const ids = partners.map((result: any) => result.value.id);
    const couple = await CouplesService.createPartner(ids, uploadedFiles[0]);
    const data = await CouplesService.getCouple({ id: couple.id });
    // The reference code is the point of this response — both partners need it
    // to fill in the intake form.
    return response
      .status(201)
      .json({ ...data, referenceCode: couple.referenceCode });
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post("/couples", [upload.single("file")], addCouples);

// Chooses which partner record in a couple a submission belongs to. Phone
// first because it is the strongest signal available, then gender, then any
// slot still waiting on a form — a couple only ever has two.
const resolveSlot = (couple: any, submittedPhone?: string, gender?: string) => {
  // A number already on the couple means this is that same person submitting
  // again — a correction or a second attempt — so they may update their own
  // record even though it is already filled in.
  if (submittedPhone) {
    const byPhone = couple.partners.find(
      (p: any) => p.phoneNumber === submittedPhone
    );
    if (byPhone) return byPhone;
  }

  // Otherwise only a slot still waiting on a form may be written to. Matching
  // a filled slot on gender alone would let anyone holding the code overwrite
  // a partner's answers.
  const outstanding = couple.partners.filter((p: any) => !p.formSubmittedAt);
  if (!outstanding.length) return null;

  if (gender) {
    const byGender = outstanding.find((p: any) => p.gender === gender);
    if (byGender) return byGender;
  }
  return outstanding[0];
};

const addCouplesDetails = async (request: Request, response: Response) => {
  try {
    const data = request.body;
    const formattedData = transformFormData(data);
    const referenceCode = normaliseReferenceCode(formattedData.referenceCode);

    // Preferred path: the couple was registered up front and both partners
    // were given a code, so there is no matching to get wrong.
    if (referenceCode) {
      const couple = await CouplesService.getCoupleByReferenceCode(
        referenceCode
      );

      if (couple) {
        const slot = resolveSlot(
          couple,
          toE164(formattedData.phoneNumber),
          formattedData.gender
        );

        if (slot) {
          await CouplesDetailsService.updateDetailsForPartner(
            slot.id,
            formattedData
          );
          getIO().to("headcounsellor").emit("formSubmitted");
          return response.status(201).json({ matched: true });
        }
      }
      // An unknown code, or a couple that already has both forms in, falls
      // through to the queue rather than overwriting somebody's answers.
    }

    // Fallback for submissions with no usable code, including every form sent
    // before codes existed. Kept so the live form keeps working unchanged.
    const details = await CouplesDetailsService.updateDetails(
      formattedData.phoneNumber,
      formattedData
    );

    if (!details) {
      return response.status(500).json({ message: "Could not save submission" });
    }

    if (!details.coupleId) {
      const partnerPhoneNumber = get(
        details,
        "partner.phoneNumber",
        ""
      ) as string;
      const foundPartner = partnerPhoneNumber
        ? await CouplesDetailsService.findPartner(partnerPhoneNumber)
        : null;

      if (foundPartner && foundPartner.id !== details.id) {
        if (foundPartner.coupleId) {
          await CouplesService.updateWithPartner(foundPartner.id, details.id);
        } else {
          // Both partners submitted before either had a couple. Previously
          // neither branch fired here and both were left with no couple at all.
          await CouplesService.createPartner([details.id, foundPartner.id]);
        }
      }
      // Otherwise the partner has not submitted yet, or the number does not
      // match anything. Leave it unattached for the unmatched queue instead of
      // creating a half-empty couple that looks ready to assign.
    }

    getIO().to("headcounsellor").emit("formSubmitted");

    const saved = await CouplesDetailsService.findPartner(
      details.phoneNumber as string
    );
    return response.status(201).json({ matched: Boolean(saved?.coupleId) });
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post("/couples/details", [], addCouplesDetails);

// Everything still waiting to be resolved by a person: submissions that could
// not be attached to any couple, and couples where a partner has not sent
// their form in yet.
const outstandingSubmissions = async (
  _request: Request,
  response: Response
) => {
  try {
    const [unmatched, awaitingForms] = await Promise.all([
      CouplesService.getUnmatchedSubmissions(),
      CouplesService.getCouplesAwaitingForms(),
    ]);
    return response.status(200).json({ unmatched, awaitingForms });
  } catch (err: any) {
    return handleError(
      response,
      err,
      "outstandingSubmissions",
      "Failed to fetch outstanding submissions"
    );
  }
};

router.get(
  "/couples/submissions/outstanding",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  outstandingSubmissions
);

const pairSubmission = async (request: Request, response: Response) => {
  try {
    const { partnerId, coupleId, otherPartnerId } = request.body;

    if (!partnerId) {
      return handleValidationError(response, "partnerId is required");
    }
    if (!coupleId && !otherPartnerId) {
      return handleValidationError(
        response,
        "Provide either coupleId or otherPartnerId"
      );
    }

    const pairedCoupleId = await CouplesService.pairSubmissions(partnerId, {
      coupleId,
      otherPartnerId,
    });
    const data = await CouplesService.getCouple({ id: pairedCoupleId });
    return response.status(200).json(data);
  } catch (err: any) {
    // These are user-correctable states (already paired, couple full), not
    // server faults, so report them as such.
    return handleValidationError(response, err.message);
  }
};

router.put(
  "/couples/submissions/pair",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  pairSubmission
);

const unAssignedCouples = async (request: Request, response: Response) => {
  try {
    const data = await CouplesService.getUnassignedCouples();
    const unassignedCouples = data.map((result) => {
      return {
        couple: result.couplesInfo,
        id: result.id,
      };
    });
    return response.status(200).json(unassignedCouples);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/couples/unassigned",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  unAssignedCouples
);

const assignCounsellor = async (request: Request, response: Response) => {
  try {
    const { counsellorId } = request.body;
    const { coupleId } = request.params;
    const data = await CouplesDetailsService.assignCounsellor(
      coupleId,
      counsellorId
    );

    const counsellor = await UsersDetailsService.getUser(counsellorId);
    const couple = await CouplesService.getCouple({ id: coupleId });
    const name1 = get(couple, "couplesInfo[0].name", "");
    const name2 = get(couple, "couplesInfo[1].name", "");
    const link = `${process.env.APP_URL}`;
    const mailOptions = {
      from: "Counsellor App <counsellortrinity@gmail.com>",
      to: counsellor?.email,
      subject: "Counseling Assignment Confirmation",
      text: "",
      html: assignCounsellorMail({ name1, name2 }, link),
    };
    // The assignment is already persisted — failing the request here would
    // report a rollback that did not happen. Surface it in the payload instead.
    let notificationSent = true;
    try {
      await sendMail(mailOptions);
    } catch (mailError: any) {
      notificationSent = false;
      console.error("assignCounsellor: assignment saved but email failed", {
        to: counsellor?.email,
        message: mailError?.message,
        code: mailError?.code,
      });
    }

    return response.status(200).json({ ...data, notificationSent });
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.put(
  "/assign/counsellor/:coupleId",
  [
    MiddlewareService.canAccessCouple,
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
  ],
  assignCounsellor
);

const getCouples = async (request: Request, response: Response) => {
  try {
    const query = request.query;
    const data = await CouplesService.getCouples(query);
    const totalLessons = await LessonsService.countLessons();
    return response.status(200).json({ couples: data, totalLessons });
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/couples",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getCouples
);

const getCouple = async (request: Request, response: Response) => {
  try {
    const coupleId = request.params.coupleId;
    const data = await CouplesService.getCouple({ id: coupleId });
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/couples/:coupleId",
  [
    MiddlewareService.canAccessCouple,
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
  ],
  getCouple
);

const markLessonAsCompleted = async (request: Request, response: Response) => {
  try {
    const coupleId = request.params.coupleId;
    const body = request.body;
    await CouplesService.updateCoupleLessons(coupleId, body);
    const data = await CouplesService.getCouple({ id: coupleId });
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.put(
  "/couples/complete-lesson/:coupleId",
  [
    MiddlewareService.canAccessCouple,
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
  ],
  markLessonAsCompleted
);

const acceptDeclineCouple = async (request: Request, response: Response) => {
  try {
    const { acceptDecline } = request.body;
    const { coupleId } = request.params;
    const data = await CouplesDetailsService.acceptDeclineCouple(
      coupleId,
      acceptDecline
    );
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.put(
  "/confirm/couple/:coupleId",
  [
    MiddlewareService.canAccessCouple,
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
  ],
  acceptDeclineCouple
);

export default router;
