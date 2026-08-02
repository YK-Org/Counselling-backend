import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { get } from "lodash";
import CouplesService from "../services/couples";
import UsersService from "../services/users";
import { JwtPayload } from "jsonwebtoken";

class MiddlewareService {
  checkAuthentication = async (req: any, res: Response, next: any) => {
    const unauthRoutes = [
      "/api/v1/couples",
      "/api/v1/forgot-password/request",
      "/api/v1/login",
      "/api/v1/forgot-password/reset",
      "/api/v1/couples/details",
      "/api/v1/questionnaire/pre-test",
      "/api/v1/questionnaire/post-test",
    ];
    if (unauthRoutes.includes(req.path) && req.method == "POST") {
      next();
    } else {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (token == null) return res.sendStatus(401);

      try {
        const decoded = jwt.verify(
          token,
          process.env.TOKEN_SECRET as string
        ) as JwtPayload;

        req.user = decoded.user;
        const user = await UsersService.getUser(req.user.id);
        if (!user || (user && decoded.iat !== user.tokenIssuedAt)) {
          return res
            .status(403)
            .json({ message: "Token has been invalidated." });
        }

        next();
      } catch (err) {
        console.error(err);
        return res.sendStatus(403);
      }
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

  queryValidation = (validationClass: any) => {
    return function (req: Request, res: Response, next: NextFunction) {
      const output: any = plainToInstance(validationClass, req.query);
      validate(output, { skipMissingProperties: false }).then((errors: any) => {
        // errors is an array of validation errors
        if (errors.length > 0) {
          const errorMessages = errors.map((error: any) => {
            return Object.values(error.constraints || {}).join(", ");
          });
          return res.status(400).json({
            message: "Validation failed",
            errors: errorMessages,
          });
        } else {
          req.query = output; // Replace query with validated output
          return next();
        }
      });
    };
  };

  canAccessCouple = async (req: any, res: Response, next: any) => {
    const role = get(req, "user.role", "");
    if (role == "headCounsellor") {
      return next();
    }

    const coupleId = req.params.coupleId;
    const userId = get(req, "user.id", "");
    const couple = await CouplesService.getCouple({ id: coupleId });

    if (couple?.counsellorId && userId === couple.counsellorId.toString()) {
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

  checkPasswordReset = async (req: any, res: Response, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token == null) return res.sendStatus(401);

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(
        token,
        process.env.TOKEN_SECRET as string
      ) as JwtPayload;
    } catch (err) {
      return res.sendStatus(403);
    }

    if (decoded.tokenType !== "passwordReset") {
      return res.sendStatus(401);
    }

    // Single-use: the link carries a nonce that is stored on the user when the
    // link is minted and cleared once it is spent, so a spent or superseded
    // link no longer matches. Previously nothing was checked beyond the
    // signature and a link stayed replayable until it expired.
    const user = await UsersService.getUser(decoded.user?.id);
    if (!user) return res.sendStatus(403);
    if (
      !decoded.resetTokenId ||
      !user.resetTokenId ||
      decoded.resetTokenId !== user.resetTokenId
    ) {
      return res.sendStatus(403);
    }

    req.user = decoded.user;

    return next();
  };
}

export default new MiddlewareService();
