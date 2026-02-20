import express, { Request, Response } from "express";
import CouplesService from "../services/couples";
import UserService from "../services/users";
import MiddlewareService from "../middleware/index";
import bcrypt from "bcrypt";
import AuthService from "../services/auth";
import { omit } from "lodash";
import multer from "multer";
import MediaService from "../services/media";
import { handleError, handleValidationError, handleNotFoundError } from "../helpers/errorHandler";
import { FILE_UPLOAD_LIMITS } from "../constants/counsellor-status";
import { AuthenticatedRequest } from "../types";
import { uploadLimiter, passwordChangeLimiter } from "../middleware/rateLimiter";

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

const changePassword = async (request: Request, response: Response) => {
  try {
    const oldPassword = request.body.oldPassword;
    const password = request.body.password;
    const id = (request as AuthenticatedRequest).user._id;

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
        ...omit(getUser.toObject(), [
          "password",
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
    const userId = (request as AuthenticatedRequest).user._id;

    if (!file) {
      return handleValidationError(response, "No file uploaded");
    }

    // Upload to Google Drive
    const uploadedFiles = await MediaService.uploadFilesToDrive(
      [file],
      "profile-pictures"
    );

    if (uploadedFiles.length === 0) {
      return response.status(500).json({ message: "Failed to upload image" });
    }

    // Store the Google Drive file ID
    await UserService.updateUser(
      { profilePicture: uploadedFiles[0].id },
      userId
    );

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
    const userId = (request as AuthenticatedRequest).user._id;
    const user = await UserService.getUser(userId);

    if (!user) {
      return handleNotFoundError(response, "User not found");
    }

    const userData = omit(user.toObject(), [
      "password",
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

const getProfilePicture = async (request: Request, response: Response) => {
  try {
    const userId = (request as AuthenticatedRequest).user._id;
    const user = await UserService.getUser(userId);

    if (!user || !user.profilePicture) {
      return handleNotFoundError(response, "Profile picture not found");
    }

    // Get file from Google Drive
    const fileName = await MediaService.getFromGoogleDrive(user.profilePicture);

    // Send the file
    return response.download(fileName, "profile-picture", (err: any) => {
      if (err) {
        response.status(500).send("Error downloading file");
      }
      // Clean up the temporary file
      const fs = require("fs");
      fs.unlink(fileName, (unlinkErr: any) => {
        if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
      });
    });
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

export default router;
