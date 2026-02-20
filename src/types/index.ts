import { Request } from "express";
import { Types } from "mongoose";

/**
 * Authenticated Request Interface
 * Extends Express Request with user information from JWT
 */
export interface AuthenticatedRequest extends Request {
  user: {
    _id: string;
    role: "headCounsellor" | "counsellor";
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Date Filter for MongoDB Queries
 */
export interface DateFilter {
  createdAt?: {
    $gte: Date;
    $lte: Date;
  };
}

/**
 * MongoDB Match Filter with Date Range
 */
export interface DateRangeMatchFilter {
  createdAt: {
    $gte: Date;
    $lte: Date;
  };
}

/**
 * Pagination Metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
