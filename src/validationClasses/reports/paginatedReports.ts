import { IsOptional, IsDateString } from "class-validator";
import { PaginationQueryDTO } from "../common/pagination";

/**
 * Optional Date Range with Pagination DTO
 * Used for reports that support optional date filtering and pagination
 */
export class OptionalDateRangeWithPaginationDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsDateString({}, { message: "startDate must be a valid ISO 8601 date" })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: "endDate must be a valid ISO 8601 date" })
  endDate?: string;
}
