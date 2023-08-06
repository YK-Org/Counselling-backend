import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { get } from "lodash";

class MiddlewareService {
  checkAuthentication = (req: any, res: Response, next: any) => {
    if (
      req.path.includes("login") ||
      (req.path == "/api/v1/couples" && req.method == "POST")
    ) {
      next();
    } else {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (token == null) return res.sendStatus(401);
      jwt.verify(
        token,
        process.env.TOKEN_SECRET as string,
        (err: any, user: any) => {
          console.log(err);

          if (err) return res.sendStatus(403);

          req.user = user;

          return next();
        }
      );
    }
  };

  requestValidation = (validationClass: any) => {
    return function (req: Request, res: Response, next: NextFunction) {
      const output: any = plainToInstance(validationClass, req.body);
      validate(output, { skipMissingProperties: true }).then((errors: any) => {
        // errors is an array of validation errors
        if (errors.length > 0) {
          let errorTexts = Array();
          for (const errorItem of errors) {
            errorTexts = errorTexts.concat(errorItem.constraints);
          }
          return res.status(400).send(errorTexts);
        } else {
          res.locals.input = output;
          return next();
        }
      });
    };
  };

  canAccessCouple = (req: any, res: Response, next: any) => {
    const role = get(req, "user.role", "");
    if (role == "headCounsellor") {
      return next();
    }

    const coupleId = req.params.coupleId;
    const userId = get(req, "user._id", "");
    if (userId == coupleId) {
      return next();
    }

    return res.sendStatus(403);
  };

  allowedRoles(roles: string[]) {
    return function (req: any, res: Response, next: any) {
      const role = req.user.role;
      if (!roles.includes(role)) {
        return res.sendStatus(403);
      }

      return next();
    };
  }
}

export default new MiddlewareService();
