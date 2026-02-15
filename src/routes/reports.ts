import express, { Request, Response } from "express";
import FormsService from "../services/forms";
import MiddlewareService from "../middleware/index";
import { Couples } from "../mongoose/models/Couples";
import { CouplesDetails } from "../mongoose/models/CouplesDetails";
import { Lessons } from "../mongoose/models/Lessons";
import { User } from "../mongoose/models/Users";

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
        $match: { completed: true },
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
    const { startDate, endDate } = request.query;

    // Build base match criteria
    const baseMatchMale: any = {
      gender: "male",
      dateOfBirth: { $exists: true, $ne: null },
    };

    const baseMatchFemale: any = {
      gender: "female",
      dateOfBirth: { $exists: true, $ne: null },
    };

    // Add date filtering if provided
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response
          .status(400)
          .json({ message: "Invalid date format. Use ISO 8601 format" });
      }

      baseMatchMale.createdAt = { $gte: start, $lte: end };
      baseMatchFemale.createdAt = { $gte: start, $lte: end };
    }

    const maleData = await CouplesDetails.aggregate([
      {
        $match: baseMatchMale,
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
        $match: baseMatchFemale,
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

const getCompletedSessionsOverTime = async (
  request: Request,
  response: Response,
) => {
  try {
    const { startDate, endDate } = request.query;

    if (!startDate || !endDate) {
      return response
        .status(400)
        .json({ message: "startDate and endDate are required" });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return response
        .status(400)
        .json({ message: "Invalid date format. Use ISO 8601 format" });
    }

    const data = await Couples.aggregate([
      {
        $match: {
          completed: true,
          updatedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$updatedAt" },
            month: { $month: "$updatedAt" },
            day: { $dayOfMonth: "$updatedAt" },
          },
          completedCount: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          completedCount: 1,
        },
      },
    ]);

    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/reports/completed/sessions", [], getCompletedSessionsOverTime);

const getCouplesStatistics = async (request: Request, response: Response) => {
  try {
    const { startDate, endDate } = request.query;

    if (!startDate || !endDate) {
      return response
        .status(400)
        .json({ message: "startDate and endDate are required" });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return response
        .status(400)
        .json({ message: "Invalid date format. Use ISO 8601 format" });
    }

    // Get all couples within the date range
    const couples = await Couples.find({
      createdAt: {
        $gte: start,
        $lte: end,
      },
    });

    // Calculate statistics
    const totalCouples = couples.length;
    const assignedCouples = couples.filter(
      (couple) => couple.counsellorId
    ).length;
    const awaitingAssignment = couples.filter(
      (couple) => !couple.counsellorId
    ).length;
    const assignedNotStarted = couples.filter(
      (couple) =>
        couple.counsellorId &&
        (!couple.lessonsCompleted || couple.lessonsCompleted.length === 0)
    ).length;

    // Calculate total completed lessons across all couples
    const totalCompletedLessons = couples.reduce(
      (sum, couple) => sum + (couple.lessonsCompleted?.length || 0),
      0
    );

    // Calculate average lesson progress
    const avgLessonProgress =
      totalCouples > 0 ? totalCompletedLessons / totalCouples : 0;

    // Get total available lessons count
    const totalLessons = await Lessons.countDocuments();

    return response.status(200).json({
      totalCouples,
      assignedCouples,
      awaitingAssignment,
      assignedNotStarted,
      avgLessonProgress: Math.round(avgLessonProgress * 100) / 100, // Round to 2 decimal places
      completedLessons: totalCompletedLessons,
      totalAvailableLessons: totalLessons,
      dateRange: {
        startDate: start,
        endDate: end,
      },
    });
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/reports/couples/statistics", [], getCouplesStatistics);

const getCounsellorStatistics = async (
  request: Request,
  response: Response
) => {
  try {
    const { startDate, endDate } = request.query;

    // Build date filter if provided
    let dateFilter: any = {};
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response
          .status(400)
          .json({ message: "Invalid date format. Use ISO 8601 format" });
      }

      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end,
        },
      };
    }

    // Get total counsellors
    const totalCounsellors = await User.countDocuments({ role: "counsellor" });

    // Get available counsellors
    const availableCounsellors = await User.countDocuments({
      role: "counsellor",
      availability: true,
    });

    // Get all couples (with date filter if provided)
    const allCouples = await Couples.find(dateFilter);
    const totalSessions = allCouples.length;
    const completedSessions = allCouples.filter((c) => c.completed).length;

    // Calculate overall completion rate
    const overallCompletionRate =
      totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    // Get counsellor workload data
    const counsellorWorkload = await Couples.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$counsellorId",
          completedCount: {
            $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
          },
          ongoingCount: {
            $sum: { $cond: [{ $eq: ["$completed", false] }, 1, 0] },
          },
          totalSessions: { $sum: 1 },
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
          completedSessions: "$completedCount",
          ongoingSessions: "$ongoingCount",
          totalSessions: 1,
          completionRate: {
            $multiply: [
              { $divide: ["$completedCount", "$totalSessions"] },
              100,
            ],
          },
        },
      },
      {
        $sort: { completionRate: -1 },
      },
    ]);

    // Calculate average completion rate
    const avgCompletionRate =
      counsellorWorkload.length > 0
        ? counsellorWorkload.reduce((sum, c) => sum + c.completionRate, 0) /
          counsellorWorkload.length
        : 0;

    // Get top performer
    const topPerformer =
      counsellorWorkload.length > 0 ? counsellorWorkload[0] : null;

    // Get counsellor with highest workload
    const highestWorkload = counsellorWorkload.reduce(
      (max, c) => (c.totalSessions > (max?.totalSessions || 0) ? c : max),
      counsellorWorkload[0] || null
    );

    // Get counsellor with lowest completion rate (excluding those with 0 sessions)
    const lowestCompletionRate = counsellorWorkload
      .filter((c) => c.totalSessions > 0)
      .reduce(
        (min, c) => (c.completionRate < (min?.completionRate || 100) ? c : min),
        counsellorWorkload[0] || null
      );

    // Count counsellors with no active sessions
    const allCounsellorsData = await User.find({ role: "counsellor" });
    const counsellorsWithSessions = new Set(
      counsellorWorkload.map((c) => c.counsellorId?.toString())
    );
    const noActiveSessions = allCounsellorsData.filter(
      (c) => !counsellorsWithSessions.has(c._id.toString())
    ).length;

    // Build counsellor progress table with status
    const counsellorProgressTable = counsellorWorkload.map((c) => {
      let status = "Good";

      // Determine status based on completion rate and workload
      if (c.completionRate < 30 && c.totalSessions > 0) {
        status = "Needs support";
      } else if (c.totalSessions > 5 && c.completionRate < 50) {
        status = "Needs support";
      } else if (c.completionRate >= 70) {
        status = "Excellent";
      }

      return {
        counsellor: c.counsellorName,
        ongoing: c.ongoingSessions,
        completed: c.completedSessions,
        total: c.totalSessions,
        completion: Math.round(c.completionRate * 100) / 100 + "%",
        status,
      };
    });

    return response.status(200).json({
      totalCounsellors,
      availableCounsellors,
      overallCompletionRate:
        Math.round(overallCompletionRate * 100) / 100 + "%",
      avgCompletionRate: Math.round(avgCompletionRate * 100) / 100 + "%",
      topPerformer: topPerformer
        ? {
            name: topPerformer.counsellorName,
            completionRate:
              Math.round(topPerformer.completionRate * 100) / 100 + "%",
          }
        : null,
      counsellorWorkload: counsellorWorkload.map((c) => ({
        ...c,
        completionRate: Math.round(c.completionRate * 100) / 100 + "%",
      })),
      sessionMix: {
        completedSessions,
        ongoingSessions: totalSessions - completedSessions,
        totalSessions,
      },
      headInsight: {
        highestWorkload: highestWorkload
          ? {
              name: highestWorkload.counsellorName,
              sessions: highestWorkload.totalSessions,
            }
          : null,
        lowestCompletionRate: lowestCompletionRate
          ? {
              name: lowestCompletionRate.counsellorName,
              completionRate:
                Math.round(lowestCompletionRate.completionRate * 100) / 100 +
                "%",
            }
          : null,
        noActiveSessions,
      },
      counsellorProgressTable,
    });
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/reports/counsellors/statistics", [], getCounsellorStatistics);

export default router;
