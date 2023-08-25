import express, { Request, Response } from "express";
import FormsService from "../services/forms";
import MiddlewareService from "../middleware/index";
import { Couples } from "../mongoose/models/Couples";
import { CouplesDetails } from "../mongoose/models/CouplesDetails";

const router = express.Router();

const getCounsellorSessions = async (request: Request, response: Response) => {
  try {
    const data = await Couples.aggregate([
      {
        $group: {
          _id: "$counsellorId",
          completedCount: {
            $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
          },
          ongoingCount: {
            $sum: { $cond: [{ $eq: ["$completed", false] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "counsellorInfo",
        },
      },
      {
        $project: {
          _id: 0,
          counsellorId: "$_id",
          counsellorName: {
            $concat: [
              { $arrayElemAt: ["$counsellorInfo.firstName", 0] },
              " ",
              { $arrayElemAt: ["$counsellorInfo.lastName", 0] },
            ],
          },
          completedCount: 1,
          ongoingCount: 1,
        },
      },
    ]);
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/reports/counsellors/sessions", [], getCounsellorSessions);

const getCompletedSessions = async (request: Request, response: Response) => {
  try {
    const data = await Couples.aggregate([
      {
        $match: { completed: false },
      },
      {
        $group: {
          _id: {
            year: { $year: "$updatedAt" },
            month: { $month: "$updatedAt" },
          },
          completedCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/reports/completed/sessions", [], getCompletedSessions);

const getAgeDistribution = async (request: Request, response: Response) => {
  try {
    const maleData = await CouplesDetails.aggregate([
      {
        $match: { gender: "male" },
      },
      {
        $addFields: {
          age: {
            $subtract: [{ $year: "$createdAt" }, { $year: "$dateOfBirth" }],
          },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [{ $lte: ["$age", 30] }, { $gte: ["$age", 20] }],
                  },
                  then: "20-30",
                },
                {
                  case: {
                    $and: [{ $lte: ["$age", 40] }, { $gt: ["$age", 31] }],
                  },
                  then: "31-40",
                },
                {
                  case: {
                    $and: [{ $lte: ["$age", 50] }, { $gt: ["$age", 41] }],
                  },
                  then: "41-50",
                },
              ],
              default: "51+",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const femaleData = await CouplesDetails.aggregate([
      {
        $match: { gender: "female" },
      },
      {
        $addFields: {
          age: {
            $subtract: [{ $year: "$createdAt" }, { $year: "$dateOfBirth" }],
          },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [{ $lte: ["$age", 30] }, { $gte: ["$age", 20] }],
                  },
                  then: "20-30",
                },
                {
                  case: {
                    $and: [{ $lte: ["$age", 40] }, { $gt: ["$age", 31] }],
                  },
                  then: "31-40",
                },
                {
                  case: {
                    $and: [{ $lte: ["$age", 50] }, { $gt: ["$age", 41] }],
                  },
                  then: "41-50",
                },
              ],
              default: "51+",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);
    return response.status(200).json({ maleData, femaleData });
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/reports/age", [], getAgeDistribution);

export default router;
