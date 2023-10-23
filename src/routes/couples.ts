import express, { Request, Response } from "express";
import { transformFormData } from "../helpers/transformFormData";
import CouplesDetailsService from "../services/couplesDetails";
import CouplesService from "../services/couples";
import { get } from "lodash";
import { getIO } from "../socket";
import LessonsService from "../services/lessons";
import MediaService from "../services/media";
import MiddlewareService from "../middleware/index";
import multer from "multer";
const upload = multer({ dest: "uploads/" });

const router = express.Router();

const addCouples = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    let uploadedFiles: string[] = [];
    if (request.file) {
      uploadedFiles = await MediaService.uploadFiles([request.file]);
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

    const ids = partners.map((result: any) => result.value._id);

    const couple = await CouplesService.createPartner(
      ids,
      uploadedFiles[0] || ""
    );
    const data = await CouplesService.getCouple({ _id: couple._id });
    return response.status(201).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post("/couples", [upload.single("file")], addCouples);

const addCouplesDetails = async (request: Request, response: Response) => {
  try {
    const data = request.body;
    const formattedData = transformFormData(data);
    const details = await CouplesDetailsService.updateDetails(
      formattedData.phoneNumber,
      formattedData
    );
    if (details) {
      const partnerPhoneNumber = get(details, "partner.phoneNumber", "");
      const foundPartner = await CouplesDetailsService.findPartner(
        partnerPhoneNumber
      );

      if (foundPartner) {
        const couple = await CouplesService.getCouple({
          partners: { $in: foundPartner._id },
        });
        if (couple && !couple.partners.includes(details._id)) {
          await CouplesService.updateWithPartner(foundPartner._id, details._id);
        }
      } else {
        await CouplesService.createPartner([details._id]);
      }
      const io = getIO();
      io.to("headcounsellor").emit("formSubmitted");
      return response.status(201).json();
    }
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post("/couples/details", [], addCouplesDetails);

const unAssignedCouples = async (request: Request, response: Response) => {
  try {
    const data = await CouplesService.getUnassignedCouples();
    const unassignedCouples = data.map((result) => {
      return {
        couple: result.couplesInfo,
        id: result._id,
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
    return response.status(200).json(data);
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
    const data = await CouplesService.getCouple({ _id: coupleId });
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
    const data = await CouplesService.getCouple({ _id: coupleId });
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

export default router;
