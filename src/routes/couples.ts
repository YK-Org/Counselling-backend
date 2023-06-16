import express, { Request, Response } from "express";
import { transformFormData } from "../helpers/transformFormData";
import CouplesDetailsService from "../services/couplesDetails";
import CouplesService from "../services/couples";
import { get } from "lodash";
import { getIO } from "../socket";

const router = express.Router();

const addCouples = async (request: Request, response: Response) => {
  try {
    const data = request.body;
    const formattedData = transformFormData(data);
    const details = await CouplesDetailsService.createDetails(formattedData);
    const partnerPhoneNumber = get(details, "partner.phoneNumber");
    const foundPartner = await CouplesDetailsService.findPartner(
      partnerPhoneNumber
    );
    if (foundPartner) {
      await CouplesService.updateWithPartner(foundPartner._id, details._id);
    } else {
      await CouplesService.createPartner(details._id);
    }
    const io = getIO();
    io.to("headcounsellor").emit("formSubmitted");
    return response.status(201).json();
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post("/couples", [], addCouples);

const unAssignedCouples = async (request: Request, response: Response) => {
  try {
    const data = await CouplesService.getUnassignedCouples();
    const unassignedCouples = data.map((result) => result.couplesInfo);
    return response.status(200).json(unassignedCouples);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/couples/unassigned", [], unAssignedCouples);

export default router;
