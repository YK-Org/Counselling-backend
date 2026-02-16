import express, { Request, Response } from "express";
import CouplesService from "../services/couples";
import UserService from "../services/users";
import MiddlewareService from "../middleware/index";
import bcrypt from "bcrypt";
import AuthService from "../services/auth";
import { omit } from "lodash";
import multer from "multer";
import MediaService from "../services/media";

const upload = multer({ dest: "uploads/profile-pictures/" });
const router = express.Router();

const dashboardInit = async (request: Request, response: Response) => {
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
    console.log(err);
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
    const id = (request as any).user._id;
    const getUser = await UserService.getUser(id);
    const checkPassword = await bcrypt.compare(
      oldPassword,
      getUser?.password || ""
    );
    if (!checkPassword) {
      throw new Error("Password could not be changed");
    }
    const password = request.body.password;
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
    return response.status(500).json({ message: err.message });
  }
};

router.post(
  "/change/password",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  changePassword
);

const uploadProfilePicture = async (request: Request, response: Response) => {
  try {
    const userId = (request as any).user._id;
    const file = request.file as Express.Multer.File;

    if (!file) {
      return response.status(400).json({ message: "No file uploaded" });
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
    return response.status(500).json({ message: err.message });
  }
};

router.post(
  "/profile/picture",
  [
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
    upload.single("profilePicture"),
  ],
  uploadProfilePicture
);

const getUserProfile = async (request: Request, response: Response) => {
  try {
    const userId = (request as any).user._id;
    const user = await UserService.getUser(userId);

    if (!user) {
      return response.status(404).json({ message: "User not found" });
    }

    const userData = omit(user.toObject(), [
      "password",
      "__v",
      "tokenIssuedAt",
    ]);

    return response.status(200).json(userData);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/profile",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getUserProfile
);

const getProfilePicture = async (request: Request, response: Response) => {
  try {
    const userId = (request as any).user._id;
    const user = await UserService.getUser(userId);

    if (!user || !user.profilePicture) {
      return response
        .status(404)
        .json({ message: "Profile picture not found" });
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
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/profile/picture",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getProfilePicture
);

export default router;
