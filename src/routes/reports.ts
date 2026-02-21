import express, { Request, Response } from "express";
import FormsService from "../services/forms";
import MiddlewareService from "../middleware/index";
import { Couples } from "../mongoose/models/Couples";
import { CouplesDetails } from "../mongoose/models/CouplesDetails";
import { Lessons } from "../mongoose/models/Lessons";
import { User } from "../mongoose/models/Users";
import { handleError, handleValidationError } from "../helpers/errorHandler";
import {
  DateRangeQueryDTO,
  OptionalDateRangeQueryDTO,
} from "../validationClasses/reports/dateRange";
import { OptionalDateRangeWithPaginationDTO } from "../validationClasses/reports/paginatedReports";
import { PaginationQueryDTO } from "../validationClasses/common/pagination";
import { COUNSELLOR_STATUS_THRESHOLDS } from "../constants/counsellor-status";
import { DateFilter } from "../types";

const router = express.Router();

const getCounsellorSessions = async (request: Request, response: Response) => {
  try {
    const { page = 1, limit = 20 } = request.query as {
      page?: number;
      limit?: number;
    };
    const skip = (page - 1) * limit;

    // Get total count and paginated data in parallel
    const [data, totalResult] = await Promise.all([
      Couples.aggregate([
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
        { $skip: skip },
        { $limit: limit },
      ]),
      Couples.aggregate([
        {
          $group: {
            _id: "$counsellorId",
          },
        },
        {
          $count: "total",
        },
      ]),
    ]);

    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return response.status(200).json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getCounsellorSessions",
      "Failed to fetch counsellor sessions data"
    );
  }
};

router.get(
  "/reports/counsellors/sessions",
  [MiddlewareService.queryValidation(PaginationQueryDTO)],
  getCounsellorSessions
);

// Helper function to get age distribution by gender
const getAgeDistributionByGender = async (
  gender: "male" | "female",
  dateFilter: DateFilter
) => {
  const matchCriteria = {
    gender,
    dateOfBirth: { $exists: true, $ne: null },
    ...dateFilter,
  };

  return CouplesDetails.aggregate([
    {
      $match: matchCriteria,
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
};

const getAgeDistribution = async (request: Request, response: Response) => {
  try {
    const { startDate, endDate } = request.query;

    // Build date filter if provided
    let dateFilter: DateFilter = {};

    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return handleValidationError(
          response,
          "Invalid date format. Use ISO 8601 format"
        );
      }

      dateFilter.createdAt = { $gte: start, $lte: end };
    }

    // Fetch both male and female data in parallel
    const [maleData, femaleData] = await Promise.all([
      getAgeDistributionByGender("male", dateFilter),
      getAgeDistributionByGender("female", dateFilter),
    ]);

    return response.status(200).json({ maleData, femaleData });
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getAgeDistribution",
      "Failed to fetch age distribution"
    );
  }
};

router.get(
  "/reports/age",
  [MiddlewareService.queryValidation(OptionalDateRangeQueryDTO)],
  getAgeDistribution
);

const getCompletedSessionsOverTime = async (
  request: Request,
  response: Response,
) => {
  try {
    const { startDate, endDate } = request.query as { startDate: string; endDate: string };

    const start = new Date(startDate);
    const end = new Date(endDate);

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
    return handleError(response, err, "getCompletedSessionsOverTime", "Failed to fetch completed sessions over time");
  }
};

router.get(
  "/reports/completed/sessions",
  [MiddlewareService.queryValidation(DateRangeQueryDTO)],
  getCompletedSessionsOverTime
);

const getCouplesStatistics = async (request: Request, response: Response) => {
  try {
    const { startDate, endDate } = request.query as { startDate: string; endDate: string };

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Use aggregation pipeline for better performance
    const stats = await Couples.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $facet: {
          totalCouples: [{ $count: "count" }],
          assignedCouples: [
            { $match: { counsellorId: { $exists: true, $ne: null } } },
            { $count: "count" },
          ],
          awaitingAssignment: [
            {
              $match: {
                $or: [
                  { counsellorId: { $exists: false } },
                  { counsellorId: null },
                ],
              },
            },
            { $count: "count" },
          ],
          assignedNotStarted: [
            {
              $match: {
                counsellorId: { $exists: true, $ne: null },
                $expr: {
                  $eq: [{ $size: { $ifNull: ["$lessonsCompleted", []] } }, 0],
                },
              },
            },
            { $count: "count" },
          ],
          lessonStats: [
            {
              $project: {
                lessonsCount: { $size: { $ifNull: ["$lessonsCompleted", []] } },
              },
            },
            {
              $group: {
                _id: null,
                totalCompletedLessons: { $sum: "$lessonsCount" },
              },
            },
          ],
        },
      },
    ]);

    // Extract counts from facet results
    const totalCouples = stats[0].totalCouples[0]?.count || 0;
    const assignedCouples = stats[0].assignedCouples[0]?.count || 0;
    const awaitingAssignment = stats[0].awaitingAssignment[0]?.count || 0;
    const assignedNotStarted = stats[0].assignedNotStarted[0]?.count || 0;
    const totalCompletedLessons =
      stats[0].lessonStats[0]?.totalCompletedLessons || 0;

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
      avgLessonProgress: Math.round(avgLessonProgress * 100) / 100,
      completedLessons: totalCompletedLessons,
      totalAvailableLessons: totalLessons,
      dateRange: {
        startDate: start,
        endDate: end,
      },
    });
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getCouplesStatistics",
      "Failed to fetch couples statistics"
    );
  }
};

router.get(
  "/reports/couples/statistics",
  [MiddlewareService.queryValidation(DateRangeQueryDTO)],
  getCouplesStatistics
);

const getCounsellorStatistics = async (
  request: Request,
  response: Response,
) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = request.query as {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    };
    const skip = (page - 1) * limit;

    // Build date filter if provided
    let dateFilter: DateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return handleValidationError(
          response,
          "Invalid date format. Use ISO 8601 format"
        );
      }

      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end,
        },
      };
    }

    // Get all counsellors (fetch once and reuse)
    const allCounsellorsData = await User.find({ role: "counsellor" });
    const totalCounsellors = allCounsellorsData.length;
    const availableCounsellors = allCounsellorsData.filter(
      (c) => c.availability === true
    ).length;

    // Get session statistics using aggregation (optimized - no memory loading)
    const [sessionStats] = await Couples.aggregate([
      { $match: dateFilter },
      {
        $facet: {
          totalSessions: [{ $count: "count" }],
          completedSessions: [
            { $match: { completed: true } },
            { $count: "count" },
          ],
        },
      },
    ]);

    const totalSessions = sessionStats.totalSessions[0]?.count || 0;
    const completedSessions = sessionStats.completedSessions[0]?.count || 0;

    // Calculate overall completion rate
    const overallCompletionRate =
      totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    // Get FULL counsellor workload data (for statistics - NO pagination)
    const counsellorWorkloadFull = await Couples.aggregate([
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

    // Calculate statistics from FULL dataset
    const avgCompletionRate =
      counsellorWorkloadFull.length > 0
        ? counsellorWorkloadFull.reduce((sum, c) => sum + c.completionRate, 0) /
          counsellorWorkloadFull.length
        : 0;

    // Get top performer from FULL dataset
    const topPerformer =
      counsellorWorkloadFull.length > 0 ? counsellorWorkloadFull[0] : null;

    // Get counsellor with highest workload from FULL dataset
    const highestWorkload = counsellorWorkloadFull.reduce(
      (max, c) => (c.totalSessions > (max?.totalSessions || 0) ? c : max),
      counsellorWorkloadFull[0] || null,
    );

    // Get counsellor with lowest completion rate from FULL dataset (excluding those with 0 sessions)
    const lowestCompletionRate = counsellorWorkloadFull
      .filter((c) => c.totalSessions > 0)
      .reduce(
        (min, c) => (c.completionRate < (min?.completionRate || 100) ? c : min),
        counsellorWorkloadFull[0] || null,
      );

    // Count counsellors with no active sessions
    const counsellorsWithSessions = new Set(
      counsellorWorkloadFull.map((c) => c.counsellorId?.toString()),
    );
    const noActiveSessions = allCounsellorsData.filter(
      (c) => !counsellorsWithSessions.has(c._id.toString()),
    ).length;

    // Get PAGINATED workload for display
    const counsellorWorkloadPaginated = counsellorWorkloadFull.slice(
      skip,
      skip + limit
    );

    // Build workload map from FULL dataset
    const workloadMap = new Map(
      counsellorWorkloadFull.map((c) => [c.counsellorId?.toString(), c]),
    );

    // Apply pagination to counsellor progress table
    const paginatedCounsellors = allCounsellorsData.slice(skip, skip + limit);
    const counsellorProgressTable = paginatedCounsellors.map((counsellor) => {
      const workloadData = workloadMap.get(counsellor._id.toString());
      const counsellorName = `${counsellor.firstName} ${counsellor.lastName}`;

      let ongoing = 0;
      let completed = 0;
      let total = 0;
      let completionRate = 0;
      let status = "No sessions";

      if (workloadData) {
        ongoing = workloadData.ongoingSessions;
        completed = workloadData.completedSessions;
        total = workloadData.totalSessions;
        completionRate = workloadData.completionRate;

        // Determine status based on completion rate and workload
        const { NEEDS_SUPPORT, EXCELLENT } = COUNSELLOR_STATUS_THRESHOLDS;

        if (completionRate < NEEDS_SUPPORT.MAX_COMPLETION_RATE && total > 0) {
          status = "Needs support";
        } else if (
          total > NEEDS_SUPPORT.HIGH_WORKLOAD_THRESHOLD &&
          completionRate < NEEDS_SUPPORT.HIGH_WORKLOAD_MAX_RATE
        ) {
          status = "Needs support";
        } else if (completionRate >= EXCELLENT.MIN_COMPLETION_RATE) {
          status = "Excellent";
        } else if (total > 0) {
          status = "Good";
        }
      }

      return {
        counsellor: counsellorName,
        ongoing,
        completed,
        total,
        completion: Math.round(completionRate * 100) / 100 + "%",
        status,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCounsellors / limit);

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
      counsellorWorkload: counsellorWorkloadPaginated.map((c) => ({
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
      pagination: {
        page,
        limit,
        total: totalCounsellors,
        totalPages,
      },
    });
  } catch (err: any) {
    return handleError(response, err, "reportEndpoint", "Failed to fetch report data");
  }
};

router.get(
  "/reports/counsellors/statistics",
  [MiddlewareService.queryValidation(OptionalDateRangeWithPaginationDTO)],
  getCounsellorStatistics
);

export default router;
