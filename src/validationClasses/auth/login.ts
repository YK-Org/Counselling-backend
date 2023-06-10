import { IsDefined, IsEmail } from "class-validator";
import { Expose } from "class-transformer";

export class LoginValidation {
  @IsDefined()
  @Expose()
  @IsEmail()
  email: String;

  @IsDefined()
  @Expose()
  password: String;
}
