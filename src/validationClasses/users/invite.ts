import { IsDefined, IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { Expose } from "class-transformer";
import { userRoles } from "../../types/models/Users";

export class InviteUserValidation {
  @IsDefined()
  @Expose()
  @IsEmail()
  email: String;

  @IsDefined()
  @Expose()
  @IsString()
  firstName: String;

  @IsDefined()
  @Expose()
  @IsString()
  lastName: String;

  // Unlike the old public /register, the role is accepted from the client here
  // — but the route is gated to head counsellors, so only an existing
  // administrator can hand out either role.
  @IsDefined()
  @Expose()
  @IsIn(userRoles)
  role: String;

  @IsOptional()
  @Expose()
  @IsString()
  phoneNumber: String;
}
