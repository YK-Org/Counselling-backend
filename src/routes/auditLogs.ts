import express, { Request, Response } from "express";
import AuditService from "../services/audit";
import MiddlewareService from "../middleware/index";
import { handleError } from "../helpers/errorHandler";
import { PaginationQueryDTO } from "../validationClasses/common/pagination";

const router = express.Router();

// Reading the trail is restricted to head counsellors: it names who opened
// whose record, so it is itself sensitive, and a counsellor being able to
// check whether their own access was noticed would defeat the point.
//
// There is deliberately no endpoint for deleting or editing entries. An audit
// trail that the people it records can alter is not one.
const getAuditLogs = async (request: Request, response: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      actorId,
      targetId,
    } = request.query as any;

    const data = await AuditService.list({
      page: Number(page),
      limit: Math.min(Number(limit), 200),
      action: typeof action === "string" ? action : undefined,
      actorId: typeof actorId === "string" ? actorId : undefined,
      targetId: typeof targetId === "string" ? targetId : undefined,
    });

    return response.status(200).json(data);
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getAuditLogs",
      "Failed to fetch audit log"
    );
  }
};

router.get(
  "/audit-logs",
  [
    MiddlewareService.allowedRoles(["headCounsellor"]),
    MiddlewareService.queryValidation(PaginationQueryDTO),
  ],
  getAuditLogs
);

export default router;
