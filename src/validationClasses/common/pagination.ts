import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Pagination Query DTO
 * Validates pagination parameters from query string
 */
export class PaginationQueryDTO {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: "page must be an integer" })
  @Min(1, { message: "page must be at least 1" })
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: "limit must be an integer" })
  @Min(1, { message: "limit must be at least 1" })
  @Max(100, { message: "limit cannot exceed 100" })
  limit?: number = 20;
}
