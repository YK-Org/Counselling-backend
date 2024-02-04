import express, { Request, Response } from "express";
import MediaService from "../services/media";
import MiddlewareService from "../middleware/index";

const router = express.Router();

const viewMedia = async (request: Request, response: Response) => {
  try {
    const fileId = request.params.mediaId;
    const data = await MediaService.viewFileInDrive(fileId);
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/media/:mediaId",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  viewMedia
);

export default router;
