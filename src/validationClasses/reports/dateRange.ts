import { IsDateString, IsNotEmpty, IsOptional } from "class-validator";

/**
 * Validation DTO for date range query parameters
 */
export class DateRangeQueryDTO {
  @IsNotEmpty({ message: "startDate is required" })
  @IsDateString({}, { message: "startDate must be a valid ISO 8601 date" })
  startDate!: string;

  @IsNotEmpty({ message: "endDate is required" })
  @IsDateString({}, { message: "endDate must be a valid ISO 8601 date" })
  endDate!: string;
}

/**
 * Validation DTO for optional date range query parameters
 */
export class OptionalDateRangeQueryDTO {
  @IsOptional()
  @IsDateString({}, { message: "startDate must be a valid ISO 8601 date" })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: "endDate must be a valid ISO 8601 date" })
  endDate?: string;
}
