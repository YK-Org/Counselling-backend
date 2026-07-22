import { IsDefined, IsEmail, IsString } from "class-validator";
import { Expose } from "class-transformer";

export class RegisterValidation {
  @IsDefined()
  @Expose()
  @IsEmail()
  email: String;

  @IsDefined()
  @Expose()
  password: String;

  @IsDefined()
  @Expose()
  @IsString()
  firstName: String;

  @IsDefined()
  @Expose()
  @IsString()
  lastName: String;

  // `role` is intentionally omitted — it is forced server-side in the
  // register handler so clients cannot self-assign a privileged role.
}
