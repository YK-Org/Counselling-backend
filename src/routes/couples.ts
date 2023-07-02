import express, { Request, Response } from "express";
import { transformFormData } from "../helpers/transformFormData";
import CouplesDetailsService from "../services/couplesDetails";
import CouplesService from "../services/couples";
import { get } from "lodash";
import { getIO } from "../socket";
import LessonsService from "../services/lessons";

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

router.get("/couples/unassigned", [], unAssignedCouples);

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

router.put("/assign/counsellor/:coupleId", [], assignCounsellor);

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

router.get("/couples", [], getCouples);

const getCouple = async (request: Request, response: Response) => {
  try {
    const coupleId = request.params.coupleId;
    const data = await CouplesService.getCouple({ _id: coupleId });
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/couples/:coupleId", [], getCouple);

export default router;
