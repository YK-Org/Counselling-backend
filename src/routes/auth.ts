import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import AuthService from "../services/auth";
import UserService from "../services/users";
import { LoginValidation } from "../validationClasses/auth/login";
import MiddlewareService from "../middleware/index";
import { omit } from "lodash";
import * as jwt from "jsonwebtoken";
import { sendMail } from "../helpers/mailer";
import {
  passwordRequestMail,
  passwordRequestMailText,
} from "../helpers/mailTemplate";
import { authLimiter } from "../middleware/rateLimiter";
import { passwordRuleError } from "../helpers/password";
import LoginAttemptsService from "../services/loginAttempts";
import AuditService, { AUDIT_ACTIONS } from "../services/audit";

const router = express.Router();

const login = async (request: Request, response: Response) => {
  try {
    const { email, password } = request.body;

    const user = await UserService.getUsers({ email });
    const account = user?.length ? user[0] : null;

    // A locked account is refused before the password is even checked, so
    // repeated guessing gains nothing during the lock.
    const lock = LoginAttemptsService.lockState(account);
    if (lock.locked) {
      AuditService.track({
        action: AUDIT_ACTIONS.LOGIN_BLOCKED,
        actor: { id: account!.id, email: account!.email, role: account!.role },
        request,
        metadata: { lockedUntil: lock.until.toISOString() },
      });
      throw new Error(
        "Too many failed sign-in attempts. Try again later or reset your password."
      );
    }

    // The password is checked before the account state, so a wrong guess
    // always gets the same answer. Reporting "not confirmed" or "disabled"
    // first told anyone who asked which addresses have accounts.
    const passwordMatches = account
      ? await bcrypt.compare(password, account.password)
      : false;

    if (!account || !passwordMatches) {
      if (account) {
        const result = await LoginAttemptsService.recordFailure(
          account.id,
          account.failedLoginAttempts
        );
        AuditService.track({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          actor: { id: account.id, email: account.email, role: account.role },
          request,
          metadata: { attempts: result.attempts, lockedNow: result.locked },
        });
      } else {
        // No account, so nothing to count against — but a run of these on
        // addresses that do not exist is itself worth being able to see.
        AuditService.track({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          actor: { email: typeof email === "string" ? email : undefined },
          request,
          metadata: { reason: "no such account" },
        });
      }
      throw new Error("Invalid Credentials");
    }

    // Only an active account may sign in. `banned` was not checked at all, so
    // banning a counsellor left them able to log in exactly as before — the
    // one control for removing someone's access to counselling records did
    // nothing.
    if (account.status === "awaitingConfirmation") {
      throw new Error("Account has not been confirmed");
    }
    if (account.status !== "active") {
      throw new Error("This account has been disabled");
    }

    {
      const userData: any = {
        ...omit(account, [
          "password",
          "resetTokenId",
          "__v",
          "createdAt",
          "updatedAt",
        ]),
      };
      const token = AuthService.generateAccessToken(userData);
      const data = {
        user: userData,
        token: token.token,
      };

      await UserService.updateUser(
        {
          tokenIssuedAt: token.issuedAt,
        },
        account.id
      );

      // A few scattered typos over months should not eventually lock a real
      // account, so the counter resets on every success.
      if (account.failedLoginAttempts > 0 || account.lockedUntil) {
        await LoginAttemptsService.clear(account.id);
      }

      AuditService.track({
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        actor: { id: account.id, email: account.email, role: account.role },
        request,
      });

      return response.status(200).send(data);
    }
  } catch (error: any) {
    return response.status(400).send(error.message);
  }
};

router.post(
  "/login",
  [authLimiter, MiddlewareService.requestValidation(LoginValidation)],
  login
);

// Public self-registration was removed: every account in this app is staff, so
// accounts are created by a head counsellor via POST /api/v1/users, and the
// very first one by `npm run prisma:seed`.

const authCheck = async (request: Request, response: Response) => {
  try {
    const authHeader = request.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) return response.sendStatus(401);
    const decoded: any = jwt.verify(token, process.env.TOKEN_SECRET as string);
    if (!decoded) {
      return response.sendStatus(401);
    }

    const data = {
      ...omit(decoded.user, [
        "password",
        "resetTokenId",
        "__v",
        "createdAt",
        "updatedAt",
        "iat",
        "exp",
      ]),
    };
    return response.status(201).json(data);
  } catch (err: any) {
    return response.status(401).json({ message: err.message });
  }
};

router.get("/auth/check", authCheck);

// Extends the session of someone who is still using the app, so the shorter
// token lifetime does not sign a counsellor out mid-appointment. Everything
// that guards an ordinary request has already run by the time this executes:
// checkAuthentication verified the signature, matched tokenIssuedAt and
// confirmed the account is still active.
const refreshToken = async (request: Request, response: Response) => {
  try {
    const id = (request as any).user.id;
    const existing = await UserService.getUser(id);
    if (!existing) return response.sendStatus(403);

    const userData: any = omit(existing, [
      "password",
      "resetTokenId",
      "createdAt",
      "updatedAt",
      "failedLoginAttempts",
      "lockedUntil",
    ]);

    const token = AuthService.generateAccessToken(userData);
    await UserService.updateUser({ tokenIssuedAt: token.issuedAt }, id);

    return response.status(200).send({ user: userData, token: token.token });
  } catch (error: any) {
    return response.status(400).send({ message: error.message });
  }
};

router.post(
  "/auth/refresh",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  refreshToken
);

const forgotPasswordRequest = async (request: Request, response: Response) => {
  try {
    const email = request.body.email;
    const user = await UserService.getUsers({ email });
    if (user && user.length) {
      const userData: any = {
        ...omit(user[0], [
          "password",
          "resetTokenId",
          "__v",
          "createdAt",
          "updatedAt",
        ]),
      };
      // Minting a new link invalidates any previous outstanding one.
      const resetTokenId = crypto.randomUUID();
      await UserService.updateUser({ resetTokenId }, user[0].id);

      const token = AuthService.generateAccessToken(
        userData,
        "passwordReset",
        "900s",
        { resetTokenId }
      );
      const link = `${process.env.APP_URL}/password/reset?tok=${token.token}`;

      const mailOptions = {
        from: "Counsellor App <counsellortrinity@gmail.com>",
        to: email,
        subject: "Password Reset",
        text: passwordRequestMailText(link),
        html: passwordRequestMail(link),
      };
      // Unlike the other senders there is nothing useful to return on failure:
      // the whole point of the request is the email, so say it did not arrive
      // rather than returning 200 and leaving the user waiting for it.
      try {
        await sendMail(mailOptions);
      } catch (mailError: any) {
        console.error("forgotPasswordRequest: failed to send reset email", {
          email,
          message: mailError?.message,
          code: mailError?.code,
        });
        return response
          .status(500)
          .json({ message: "Could not send the reset email. Please try again." });
      }
    } else {
      throw new Error("User cannot be found");
    }
    return response.status(200).send({});
  } catch (error: any) {
    console.log("error", error);
    return response.status(400).send(error);
  }
};

router.post("/forgot-password/request", [authLimiter], forgotPasswordRequest);

const forgotPasswordReset = async (request: Request, response: Response) => {
  try {
    const password = request.body.password;
    const id = (request as any).user.id;

    // This endpoint also consumes invite links, so it sets every counsellor's
    // first password. It previously accepted anything at all, which made the
    // account-creation path the one with no strength requirement.
    const passwordError = passwordRuleError(password);
    if (passwordError) {
      return response.status(400).send({ message: passwordError });
    }

    const encryptedUserPassword = await bcrypt.hash(password, 10);

    // Consuming an invite link is what activates the account — setting a
    // password is the confirmation. Only awaitingConfirmation is promoted, so
    // a banned user cannot reinstate themselves via password reset.
    const existing = await UserService.getUser(id);
    const activates = existing?.status === "awaitingConfirmation";

    const user = await UserService.updateUser(
      {
        password: encryptedUserPassword,
        // Spend the link — it must not work a second time.
        resetTokenId: null,
        ...(activates ? { status: "active" } : {}),
      },
      id
    );
    if (user) {
      const userData: any = {
        ...omit(user, ["password","resetTokenId", "__v", "createdAt", "updatedAt"]),
      };
      const token = AuthService.generateAccessToken(userData);
      const data = {
        user: userData,
        token: token.token,
      };

      await UserService.updateUser(
        {
          tokenIssuedAt: token.issuedAt,
        },
        user.id
      );

      return response.status(200).send(data);
    } else {
      throw new Error("Error resetting password");
    }
  } catch (error) {
    return response.status(400).send(error);
  }
};

router.post(
  "/forgot-password/reset",
  [MiddlewareService.checkPasswordReset],
  forgotPasswordReset
);

const confirmPassword = async (request: Request, response: Response) => {
  try {
    const password = request.body.password;
    const id = (request as any).user.id;
    const user = await UserService.getUser(id);
    const checkPassword = await bcrypt.compare(password, user?.password || "");
    if (!checkPassword) {
      throw new Error("Invalid credentials");
    }
    return response.status(200).send({});
  } catch (error: any) {
    return response.status(400).send(error.message);
  }
};

router.post(
  "/confirm-password",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  confirmPassword
);
export default router;
