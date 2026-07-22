import express, { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../prisma/client";
import MiddlewareService from "../middleware/index";
import { handleError, handleValidationError } from "../helpers/errorHandler";
import {
  DateRangeQueryDTO,
  OptionalDateRangeQueryDTO,
} from "../validationClasses/reports/dateRange";
import { OptionalDateRangeWithPaginationDTO } from "../validationClasses/reports/paginatedReports";
import { PaginationQueryDTO } from "../validationClasses/common/pagination";
import { COUNSELLOR_STATUS_THRESHOLDS } from "../constants/counsellor-status";

const router = express.Router();

const getCounsellorSessions = async (request: Request, response: Response) => {
  try {
    const { page = 1, limit = 20 } = request.query as {
      page?: number;
      limit?: number;
    };
    const skip = (page - 1) * limit;

    const [data, totalResult] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          counsellorId: string | null;
          counsellorName: string | null;
          completedCount: number;
          ongoingCount: number;
        }>
      >(Prisma.sql`
        SELECT
          c."counsellorId" AS "counsellorId",
          CONCAT(u."firstName", ' ', u."lastName") AS "counsellorName",
          COUNT(*) FILTER (WHERE c."completed")::int AS "completedCount",
          COUNT(*) FILTER (WHERE NOT c."completed")::int AS "ongoingCount"
        FROM "Couple" c
        LEFT JOIN "User" u ON u."id" = c."counsellorId"
        GROUP BY c."counsellorId", u."firstName", u."lastName"
        LIMIT ${limit} OFFSET ${skip}
      `),
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(DISTINCT c."counsellorId")::int AS total FROM "Couple" c
      `),
    ]);

    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return response.status(200).json({
      data,
      pagination: { page, limit, total, totalPages },
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

// Age distribution for one gender, optionally constrained to a created-at range.
const getAgeDistributionByGender = async (
  gender: "male" | "female",
  start?: Date,
  end?: Date
) => {
  const dateCond =
    start && end
      ? Prisma.sql`AND p."createdAt" BETWEEN ${start} AND ${end}`
      : Prisma.empty;

  return prisma.$queryRaw<Array<{ range: string; count: number }>>(Prisma.sql`
    SELECT bucket AS "range", COUNT(*)::int AS count
    FROM (
      SELECT CASE
        WHEN age BETWEEN 20 AND 30 THEN '20-30'
        WHEN age BETWEEN 31 AND 40 THEN '31-40'
        WHEN age BETWEEN 41 AND 50 THEN '41-50'
        ELSE '51+'
      END AS bucket
      FROM (
        SELECT (EXTRACT(YEAR FROM p."createdAt") - EXTRACT(YEAR FROM p."dateOfBirth")) AS age
        FROM "Partner" p
        WHERE p."gender" = ${gender}::"Gender"
          AND p."dateOfBirth" IS NOT NULL
          ${dateCond}
      ) ages
    ) buckets
    GROUP BY bucket
  `);
};

const getAgeDistribution = async (request: Request, response: Response) => {
  try {
    const { startDate, endDate } = request.query;

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return handleValidationError(
          response,
          "Invalid date format. Use ISO 8601 format"
        );
      }
    }

    const [maleData, femaleData] = await Promise.all([
      getAgeDistributionByGender("male", start, end),
      getAgeDistributionByGender("female", start, end),
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
  response: Response
) => {
  try {
    const { startDate, endDate } = request.query as {
      startDate: string;
      endDate: string;
    };

    const start = new Date(startDate);
    const end = new Date(endDate);

    const data = await prisma.$queryRaw<
      Array<{ date: Date; completedCount: number }>
    >(Prisma.sql`
      SELECT date_trunc('day', c."updatedAt") AS date,
             COUNT(*)::int AS "completedCount"
      FROM "Couple" c
      WHERE c."completed" = true
        AND c."updatedAt" BETWEEN ${start} AND ${end}
      GROUP BY date_trunc('day', c."updatedAt")
      ORDER BY date ASC
    `);

    return response.status(200).json(data);
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getCompletedSessionsOverTime",
      "Failed to fetch completed sessions over time"
    );
  }
};

router.get(
  "/reports/completed/sessions",
  [MiddlewareService.queryValidation(DateRangeQueryDTO)],
  getCompletedSessionsOverTime
);

const getCouplesStatistics = async (request: Request, response: Response) => {
  try {
    const { startDate, endDate } = request.query as {
      startDate: string;
      endDate: string;
    };

    const start = new Date(startDate);
    const end = new Date(endDate);
    const createdAt = { gte: start, lte: end };

    const [
      totalCouples,
      assignedCouples,
      awaitingAssignment,
      assignedNotStarted,
      totalCompletedLessons,
      totalLessons,
    ] = await Promise.all([
      prisma.couple.count({ where: { createdAt } }),
      prisma.couple.count({ where: { createdAt, counsellorId: { not: null } } }),
      prisma.couple.count({ where: { createdAt, counsellorId: null } }),
      prisma.couple.count({
        where: {
          createdAt,
          counsellorId: { not: null },
          lessonsCompleted: { none: {} },
        },
      }),
      prisma.coupleLessonCompleted.count({ where: { couple: { createdAt } } }),
      prisma.lesson.count(),
    ]);

    const avgLessonProgress =
      totalCouples > 0 ? totalCompletedLessons / totalCouples : 0;

    return response.status(200).json({
      totalCouples,
      assignedCouples,
      awaitingAssignment,
      assignedNotStarted,
      avgLessonProgress: Math.round(avgLessonProgress * 100) / 100,
      completedLessons: totalCompletedLessons,
      totalAvailableLessons: totalLessons,
      dateRange: { startDate: start, endDate: end },
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

const getCounsellorStatistics = async (request: Request, response: Response) => {
  try {
    const {
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = request.query as {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    };
    const skip = (page - 1) * limit;

    // Build optional date filter.
    let start: Date | undefined;
    let end: Date | undefined;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return handleValidationError(
          response,
          "Invalid date format. Use ISO 8601 format"
        );
      }
    }
    const dateWhere =
      start && end ? { createdAt: { gte: start, lte: end } } : {};
    const rawDateCond =
      start && end
        ? Prisma.sql`WHERE c."createdAt" BETWEEN ${start} AND ${end}`
        : Prisma.empty;

    // All counsellors (fetched once and reused).
    const allCounsellorsData = await prisma.user.findMany({
      where: { role: "counsellor" },
    });
    const totalCounsellors = allCounsellorsData.length;
    const availableCounsellors = allCounsellorsData.filter(
      (c) => c.availability === true
    ).length;

    // Session statistics.
    const [totalSessions, completedSessions] = await Promise.all([
      prisma.couple.count({ where: dateWhere }),
      prisma.couple.count({ where: { ...dateWhere, completed: true } }),
    ]);

    const overallCompletionRate =
      totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    // Full counsellor workload (no pagination — used for aggregate metrics).
    const counsellorWorkloadFull = await prisma.$queryRaw<
      Array<{
        counsellorId: string | null;
        counsellorName: string | null;
        completedSessions: number;
        ongoingSessions: number;
        totalSessions: number;
        completionRate: number;
      }>
    >(Prisma.sql`
      SELECT
        c."counsellorId" AS "counsellorId",
        CONCAT(u."firstName", ' ', u."lastName") AS "counsellorName",
        COUNT(*) FILTER (WHERE c."completed")::int AS "completedSessions",
        COUNT(*) FILTER (WHERE NOT c."completed")::int AS "ongoingSessions",
        COUNT(*)::int AS "totalSessions",
        (COUNT(*) FILTER (WHERE c."completed")::float / COUNT(*)) * 100 AS "completionRate"
      FROM "Couple" c
      LEFT JOIN "User" u ON u."id" = c."counsellorId"
      ${rawDateCond}
      GROUP BY c."counsellorId", u."firstName", u."lastName"
      ORDER BY "completionRate" DESC
    `);

    const avgCompletionRate =
      counsellorWorkloadFull.length > 0
        ? counsellorWorkloadFull.reduce((sum, c) => sum + c.completionRate, 0) /
          counsellorWorkloadFull.length
        : 0;

    const topPerformer =
      counsellorWorkloadFull.length > 0 ? counsellorWorkloadFull[0] : null;

    const highestWorkload = counsellorWorkloadFull.reduce(
      (max, c) => (c.totalSessions > (max?.totalSessions || 0) ? c : max),
      counsellorWorkloadFull[0] || null
    );

    const lowestCompletionRate = counsellorWorkloadFull
      .filter((c) => c.totalSessions > 0)
      .reduce(
        (min, c) => (c.completionRate < (min?.completionRate || 100) ? c : min),
        counsellorWorkloadFull[0] || null
      );

    const counsellorsWithSessions = new Set(
      counsellorWorkloadFull.map((c) => c.counsellorId?.toString())
    );
    const noActiveSessions = allCounsellorsData.filter(
      (c) => !counsellorsWithSessions.has(c.id)
    ).length;

    const counsellorWorkloadPaginated = counsellorWorkloadFull.slice(
      skip,
      skip + limit
    );

    const workloadMap = new Map(
      counsellorWorkloadFull.map((c) => [c.counsellorId?.toString(), c])
    );

    const paginatedCounsellors = allCounsellorsData.slice(skip, skip + limit);
    const counsellorProgressTable = paginatedCounsellors.map((counsellor) => {
      const workloadData = workloadMap.get(counsellor.id);
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
    return handleError(
      response,
      err,
      "reportEndpoint",
      "Failed to fetch report data"
    );
  }
};

router.get(
  "/reports/counsellors/statistics",
  [MiddlewareService.queryValidation(OptionalDateRangeWithPaginationDTO)],
  getCounsellorStatistics
);

export default router;
