import express, { Request, Response } from "express";
import CouplesService from "../services/couples";
import UserService from "../services/users";
import MiddlewareService from "../middleware/index";
import bcrypt from "bcrypt";
import AuthService from "../services/auth";
import { omit } from "lodash";
import multer from "multer";
import StorageService from "../services/storage";
import crypto from "crypto";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
  handleForbiddenError,
} from "../helpers/errorHandler";
import { FILE_UPLOAD_LIMITS } from "../constants/counsellor-status";
import { AuthenticatedRequest } from "../types";
import {
  uploadLimiter,
  passwordChangeLimiter,
  inviteLimiter,
} from "../middleware/rateLimiter";
import { InviteUserValidation } from "../validationClasses/users/invite";
import { inviteMail, inviteMailText } from "../helpers/mailTemplate";
import { sendMail } from "../helpers/mailer";

// Configure multer with validation
const { PROFILE_PICTURE } = FILE_UPLOAD_LIMITS;

const upload = multer({
  dest: "uploads/profile-pictures/",
  limits: {
    fileSize: PROFILE_PICTURE.MAX_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    // Check MIME type against allowed types
    if (PROFILE_PICTURE.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
        ) as any,
        false
      );
    }
  },
});

const router = express.Router();

// Middleware to handle multer errors
const handleMulterError = (err: any, _req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File size too large. Maximum size is 5MB.",
      });
    }
    return res.status(400).json({
      message: `Upload error: ${err.message}`,
    });
  } else if (err) {
    // Handle custom errors from fileFilter
    return res.status(400).json({
      message: err.message,
    });
  }
  next();
};

const dashboardInit = async (_request: Request, response: Response) => {
  try {
    const unassignedCouplesCount =
      await CouplesService.countUnassignedCouples();
    const availableCounsellorsCount =
      await UserService.countAvailableCounsellors();
    const countCompletedSessions =
      await CouplesService.countCompletedSessions();
    return response.status(200).json({
      unassignedCouplesCount,
      availableCounsellorsCount,
      countCompletedSessions,
    });
  } catch (err) {
    return handleError(
      response,
      err,
      "dashboardInit",
      "Failed to fetch dashboard data"
    );
  }
};

router.get(
  "/dashboard/init",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  dashboardInit
);

// How long an invitee has to set their password before the link dies.
const INVITE_TOKEN_TTL = "7d";

const inviteUser = async (request: Request, response: Response) => {
  try {
    const { email, firstName, lastName, phoneNumber, role } = request.body;

    // The invitee picks their own password via the emailed link. Until then the
    // account is unreachable: this placeholder is random, never disclosed, and
    // no plaintext matches its hash. Emailing a generated password instead
    // would leave a working credential sitting in an inbox indefinitely.
    const unusablePassword = crypto.randomBytes(32).toString("hex");

    const user = await UserService.createUser({
      email,
      firstName,
      lastName,
      phoneNumber,
      role,
      password: unusablePassword,
      status: "awaitingConfirmation",
    });

    const userData: any = omit(user, [
      "password",
      "resetTokenId",
      "tokenIssuedAt",
    ]);

    // Reuses the password-reset token type, so the existing
    // /forgot-password/reset endpoint and its frontend page accept the link
    // as-is. Setting a password there flips the account to active.
    const resetTokenId = crypto.randomUUID();
    await UserService.updateUser({ resetTokenId }, user.id);

    const token = AuthService.generateAccessToken(
      userData,
      "passwordReset",
      INVITE_TOKEN_TTL,
      { resetTokenId }
    );
    // Same page as a password reset, but `invite=1` lets it greet a first-time
    // invitee ("set your password") instead of talking about resetting one.
    const link = `${process.env.APP_URL}/password/reset?tok=${token.token}&invite=1`;
    const roleLabel =
      user.role === "headCounsellor" ? "head counsellor" : "counsellor";

    // The account exists at this point, so a mail failure must not 500 the
    // request — but it must not be reported as a clean success either, or the
    // invitee is left with an account and no way to reach it.
    let inviteEmailSent = true;
    try {
      await sendMail({
        from: "Counsellor App <counsellortrinity@gmail.com>",
        to: email,
        subject: "You have been invited to the Counsellor App",
        text: inviteMailText(user.firstName, roleLabel, link),
        html: inviteMail(user.firstName, roleLabel, link),
      });
    } catch (mailError: any) {
      inviteEmailSent = false;
      console.error("inviteUser: account created but invite email failed", {
        email,
        message: mailError?.message,
        code: mailError?.code,
      });
    }

    return response.status(201).json({ ...userData, inviteEmailSent });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return handleConflictError(
        response,
        "A user with that email already exists"
      );
    }
    return handleError(response, err, "inviteUser", "Failed to invite user");
  }
};

router.post(
  "/users",
  [
    inviteLimiter,
    MiddlewareService.allowedRoles(["headCounsellor"]),
    MiddlewareService.requestValidation(InviteUserValidation),
  ],
  inviteUser
);

const changePassword = async (request: Request, response: Response) => {
  try {
    const oldPassword = request.body.oldPassword;
    const password = request.body.password;
    const id = (request as AuthenticatedRequest).user.id;

    // Validate that new password is different from old password
    if (password === oldPassword) {
      return handleValidationError(
        response,
        "New password must be different from old password"
      );
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return handleValidationError(
        response,
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
      );
    }

    const getUser = await UserService.getUser(id);
    const checkPassword = await bcrypt.compare(
      oldPassword,
      getUser?.password || ""
    );
    if (!checkPassword) {
      return handleValidationError(response, "Current password is incorrect");
    }
    const encryptedUserPassword = await bcrypt.hash(password, 10);

    if (getUser) {
      const userData: any = {
        ...omit(getUser, [
          "password",
          "resetTokenId",
          "__v",
          "createdAt",
          "updatedAt",
        ]),
      };
      const token = AuthService.generateAccessToken(userData);
      const data = {
        user: userData,
        token: token.token,
      };

      await UserService.updateUser(
        { password: encryptedUserPassword, tokenIssuedAt: token.issuedAt },
        id
      );

      return response.status(200).send(data);
    } else {
      throw new Error("Error changing password");
    }
  } catch (err: any) {
    return handleError(
      response,
      err,
      "changePassword",
      "Failed to change password"
    );
  }
};

router.post(
  "/change/password",
  [
    passwordChangeLimiter,
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
  ],
  changePassword
);

const uploadProfilePicture = async (request: Request, response: Response) => {
  const file = request.file as Express.Multer.File;

  try {
    const userId = (request as AuthenticatedRequest).user.id;

    if (!file) {
      return handleValidationError(response, "No file uploaded");
    }

    const uploadedFiles = await StorageService.uploadFiles(
      [file],
      "profile-pictures"
    );

    if (uploadedFiles.length === 0) {
      return response.status(500).json({ message: "Failed to upload image" });
    }

    // Store the Google Drive file ID
    const previous = await UserService.getUser(userId);
    await UserService.updateUser(
      { profilePicture: uploadedFiles[0].id },
      userId
    );

    // Drop the superseded image. Nothing references it once the column moves
    // on, so leaving it would accumulate orphans in Drive and on disk.
    if (previous?.profilePicture) {
      await StorageService.deleteFiles([previous.profilePicture]).catch(
        (err: any) =>
          console.error(
            "Could not delete previous profile picture",
            err?.message
          )
      );
    }

    return response.status(200).json({
      message: "Profile picture uploaded successfully",
      fileId: uploadedFiles[0].id,
      fileName: uploadedFiles[0].name,
    });
  } catch (err: any) {
    // Clean up temporary file on error
    if (file?.path) {
      const fs = require("fs");
      fs.unlink(file.path, (unlinkErr: any) => {
        if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
      });
    }

    console.error("Error uploading profile picture:", err);
    return response
      .status(500)
      .json({ message: "Failed to upload profile picture" });
  }
};

router.post(
  "/profile/picture",
  [
    uploadLimiter,
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
    upload.single("profilePicture"),
    handleMulterError,
  ],
  uploadProfilePicture
);

const getUserProfile = async (request: Request, response: Response) => {
  try {
    const userId = (request as AuthenticatedRequest).user.id;
    const user = await UserService.getUser(userId);

    if (!user) {
      return handleNotFoundError(response, "User not found");
    }

    const userData = omit(user, [
      "password",
      "resetTokenId",
      "__v",
      "tokenIssuedAt",
    ]);

    return response.status(200).json(userData);
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getUserProfile",
      "Failed to fetch user profile"
    );
  }
};

router.get(
  "/profile",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getUserProfile
);

// Returns a short-lived signed URL rather than the bytes. The browser fetches
// straight from R2, so no image passes through this server and there is no
// cache to keep coherent. Authorization still happens here — the URL is only
// issued to a caller already allowed to see it.
const sendProfilePicture = async (response: Response, key: string) => {
  const url = await StorageService.getSignedUrl(key);
  return response.status(200).json({ url });
};

const getProfilePicture = async (request: Request, response: Response) => {
  try {
    const userId = (request as AuthenticatedRequest).user.id;
    const user = await UserService.getUser(userId);

    if (!user || !user.profilePicture) {
      return handleNotFoundError(response, "Profile picture not found");
    }

    return await sendProfilePicture(response, user.profilePicture);
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getProfilePicture",
      "Failed to retrieve profile picture"
    );
  }
};

router.get(
  "/profile/picture",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getProfilePicture
);

const deleteProfilePicture = async (request: Request, response: Response) => {
  try {
    const userId = (request as AuthenticatedRequest).user.id;
    const user = await UserService.getUser(userId);

    if (!user?.profilePicture) {
      return handleNotFoundError(response, "No profile picture to delete");
    }

    const key = user.profilePicture;

    // Clear the reference first: the column is the source of truth, and if the
    // object delete fails afterwards the worst case is an orphaned file rather
    // than a user pointing at an image that no longer exists.
    await UserService.updateUser({ profilePicture: null }, userId);

    await StorageService.deleteFiles([key]).catch((err: any) =>
      console.error("Could not delete profile picture from R2", err?.message)
    );

    return response
      .status(200)
      .json({ message: "Profile picture removed successfully" });
  } catch (err: any) {
    return handleError(
      response,
      err,
      "deleteProfilePicture",
      "Failed to remove profile picture"
    );
  }
};

router.delete(
  "/profile/picture",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  deleteProfilePicture
);

const getUserPicture = async (request: Request, response: Response) => {
  try {
    const { userId } = request.params;
    const requester = (request as AuthenticatedRequest).user;

    // Head counsellors manage everyone, so they may see any picture. Everyone
    // else may only fetch their own — a counsellor has no reason to enumerate
    // colleagues through this route.
    if (requester.role !== "headCounsellor" && requester.id !== userId) {
      return handleForbiddenError(response);
    }

    const user = await UserService.getUser(userId);

    if (!user || !user.profilePicture) {
      return handleNotFoundError(response, "Profile picture not found");
    }

    return await sendProfilePicture(response, user.profilePicture);
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getUserPicture",
      "Failed to retrieve profile picture"
    );
  }
};

router.get(
  "/users/:userId/picture",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getUserPicture
);

export default router;
