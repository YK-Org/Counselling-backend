import { Request } from "express";
import prisma from "../../prisma/client";

// The actions worth recording. A fixed list rather than free strings, so the
// log stays queryable and a typo cannot quietly create a category nobody
// looks at.
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "auth.login.success",
  LOGIN_FAILED: "auth.login.failed",
  LOGIN_BLOCKED: "auth.login.blocked",
  PASSWORD_CHANGED: "auth.password.changed",
  PASSWORD_RESET: "auth.password.reset",
  PASSWORD_RESET_REQUESTED: "auth.password.reset_requested",

  COUPLE_VIEWED: "couple.view",
  COUPLE_CREATED: "couple.create",
  COUPLE_ASSIGNED: "couple.assign",
  COUPLE_ACCEPT_DECLINE: "couple.accept_decline",
  QUESTIONNAIRE_VIEWED: "questionnaire.view",
  QUESTIONNAIRE_LINKED: "questionnaire.link",
  SUBMISSION_PAIRED: "submission.pair",

  MEDIA_DOWNLOADED: "media.download",

  USER_INVITED: "user.invite",
  USER_UPDATED: "user.update",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

type Actor = { id?: string; email?: string; role?: string } | undefined;

type AuditInput = {
  action: AuditAction;
  actor?: Actor;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
};

// Trims a header to something storable. A user agent is attacker-controlled
// and unbounded, and there is no reason to keep more than enough to tell one
// browser from another.
const clip = (value: unknown, max = 256) =>
  typeof value === "string" && value ? value.slice(0, max) : null;

const ipOf = (request?: Request) => {
  if (!request) return null;
  // Express resolves this from X-Forwarded-For when `trust proxy` is set,
  // which it is in production. Without that it would be the proxy's own
  // address for every request and the field would say nothing.
  return clip(request.ip, 64);
};

class AuditService {
  // Writing the trail must never break the thing being recorded: a failure
  // here is logged and swallowed, so a full disk cannot stop a counsellor
  // opening a record. The trade-off is deliberate and worth stating — this
  // prioritises availability over guaranteed capture.
  async record(input: AuditInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: input.action,
          actorId: input.actor?.id ?? null,
          actorEmail: clip(input.actor?.email, 320),
          actorRole: clip(input.actor?.role, 32),
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          ipAddress: ipOf(input.request),
          userAgent: clip(input.request?.headers["user-agent"]),
          metadata: (input.metadata as any) ?? undefined,
        },
      });
    } catch (error: any) {
      console.error("audit: failed to write entry", {
        action: input.action,
        message: error?.message,
      });
    }
  }

  // Fire-and-forget. Read paths should not wait on the audit write before
  // answering — the entry lands a moment later either way.
  track(input: AuditInput): void {
    void this.record(input);
  }

  async list(filter: {
    page: number;
    limit: number;
    action?: string;
    actorId?: string;
    targetId?: string;
  }) {
    const where: any = {};
    if (filter.action) where.action = filter.action;
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.targetId) where.targetId = filter.targetId;

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: entries,
      pagination: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.ceil(total / filter.limit),
      },
    };
  }
}

export default new AuditService();
