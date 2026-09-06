import request from "supertest";
import {
  describeDb,
  getApp,
  getPrisma,
  resetDatabase,
  disconnect,
  createUser,
  createCouple,
  signIn,
  PASSWORD,
} from "./setup";

// Banning a counsellor used to change a database column and nothing else: they
// could still sign in, and any session they already held kept working until
// its token expired. These pin all three parts of the fix.

describeDb("sign-in and session control", () => {
  let app: any;
  let prisma: any;

  beforeAll(() => {
    app = getApp();
    prisma = getPrisma();
  });

  afterAll(disconnect);
  beforeEach(resetDatabase);

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe("banning", () => {
    it("stops a banned counsellor signing in", async () => {
      const user = await createUser({ email: "banned@test.local", status: "banned" });
      const res = await request(app)
        .post("/api/v1/login")
        .send({ email: user.email, password: PASSWORD });
      expect(res.status).toBe(400);
      expect(res.text).toContain("disabled");
    });

    it("kills a session that already exists", async () => {
      const head = await createUser({ email: "h@test.local", role: "headCounsellor" });
      const victim = await createUser({ email: "v@test.local", role: "counsellor" });
      await createCouple({ counsellorId: victim.id });

      const victimToken = (await signIn(app, victim.email))!;
      const headToken = (await signIn(app, head.email))!;

      // Valid a moment ago.
      expect((await request(app).get("/api/v1/couples").set(auth(victimToken))).status).toBe(200);

      await request(app)
        .put(`/api/v1/counsellors/${victim.id}`)
        .set(auth(headToken))
        .send({ status: "banned" });

      // And now not, without waiting for the token to expire.
      expect((await request(app).get("/api/v1/couples").set(auth(victimToken))).status).toBe(403);
    });

    it("clears tokenIssuedAt so no old token can match", async () => {
      const head = await createUser({ email: "h2@test.local", role: "headCounsellor" });
      const victim = await createUser({ email: "v2@test.local", role: "counsellor" });
      await signIn(app, victim.email);
      const headToken = (await signIn(app, head.email))!;

      await request(app)
        .put(`/api/v1/counsellors/${victim.id}`)
        .set(auth(headToken))
        .send({ status: "banned" });

      const after = await prisma.user.findUnique({ where: { id: victim.id } });
      expect(after.tokenIssuedAt).toBeNull();
    });

    it("lets an unbanned counsellor back in", async () => {
      const head = await createUser({ email: "h3@test.local", role: "headCounsellor" });
      const victim = await createUser({ email: "v3@test.local", status: "banned" });
      const headToken = (await signIn(app, head.email))!;

      await request(app)
        .put(`/api/v1/counsellors/${victim.id}`)
        .set(auth(headToken))
        .send({ status: "active" });

      expect(await signIn(app, victim.email)).toBeTruthy();
    });

    it("blocks an account still awaiting confirmation", async () => {
      const user = await createUser({
        email: "pending@test.local",
        status: "awaitingConfirmation",
      });
      const res = await request(app)
        .post("/api/v1/login")
        .send({ email: user.email, password: PASSWORD });
      expect(res.status).toBe(400);
      expect(res.text).toContain("not been confirmed");
    });
  });

  describe("not disclosing which accounts exist", () => {
    it("gives the same answer for a wrong password and an unknown address", async () => {
      await createUser({ email: "real@test.local" });

      const wrongPassword = await request(app)
        .post("/api/v1/login")
        .send({ email: "real@test.local", password: "Wr0ng!Pass" });
      const noSuchUser = await request(app)
        .post("/api/v1/login")
        .send({ email: "nobody@test.local", password: "Wr0ng!Pass" });

      expect(wrongPassword.text).toBe(noSuchUser.text);
      expect(wrongPassword.status).toBe(noSuchUser.status);
    });

    it("does not reveal a banned account to someone without the password", async () => {
      // Status is only reported once the password is right.
      await createUser({ email: "banned2@test.local", status: "banned" });
      const res = await request(app)
        .post("/api/v1/login")
        .send({ email: "banned2@test.local", password: "Wr0ng!Pass" });
      expect(res.text).toContain("Invalid Credentials");
      expect(res.text).not.toContain("disabled");
    });
  });

  describe("account lockout", () => {
    it("locks after repeated failures and refuses the correct password", async () => {
      const user = await createUser({ email: "lock@test.local" });

      for (let i = 0; i < 8; i++) {
        await request(app)
          .post("/api/v1/login")
          .send({ email: user.email, password: "Wr0ng!Pass" });
      }

      const locked = await prisma.user.findUnique({ where: { id: user.id } });
      expect(locked.failedLoginAttempts).toBe(8);
      expect(locked.lockedUntil).not.toBeNull();

      const res = await request(app)
        .post("/api/v1/login")
        .send({ email: user.email, password: PASSWORD });
      expect(res.status).toBe(400);
      expect(res.text).toContain("Too many failed sign-in attempts");
    });

    it("does not affect anyone else on the same address", async () => {
      // The per-IP limiter alone locked out a whole office when one person
      // mistyped their password.
      const victim = await createUser({ email: "lock2@test.local" });
      const colleague = await createUser({ email: "colleague@test.local" });

      for (let i = 0; i < 8; i++) {
        await request(app)
          .post("/api/v1/login")
          .send({ email: victim.email, password: "Wr0ng!Pass" });
      }

      expect(await signIn(app, colleague.email)).toBeTruthy();
    });

    it("resets the counter on a successful sign-in", async () => {
      const user = await createUser({ email: "lock3@test.local" });
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/api/v1/login")
          .send({ email: user.email, password: "Wr0ng!Pass" });
      }
      expect((await prisma.user.findUnique({ where: { id: user.id } })).failedLoginAttempts).toBe(3);

      await signIn(app, user.email);
      const after = await prisma.user.findUnique({ where: { id: user.id } });
      expect(after.failedLoginAttempts).toBe(0);
      expect(after.lockedUntil).toBeNull();
    });

    it("lets a user back in once the lock expires", async () => {
      const user = await createUser({ email: "lock4@test.local" });
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 8, lockedUntil: new Date(Date.now() - 60_000) },
      });
      expect(await signIn(app, user.email)).toBeTruthy();
    });
  });

  describe("password policy", () => {
    it("is enforced on the change-password endpoint", async () => {
      const user = await createUser({ email: "pw@test.local" });
      const token = (await signIn(app, user.email))!;

      const res = await request(app)
        .post("/api/v1/change/password")
        .set(auth(token))
        .send({ oldPassword: PASSWORD, password: "weakpass1" });
      expect(res.status).toBe(400);
    });

    it("is enforced on the reset endpoint, which also sets invited passwords", async () => {
      const AuthService = require("../../src/services/auth").default;
      const crypto = require("crypto");
      const user = await createUser({ email: "reset@test.local", status: "awaitingConfirmation" });
      const resetTokenId = crypto.randomUUID();
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenId } });
      const { token } = AuthService.generateAccessToken(
        { id: user.id },
        "passwordReset",
        "900s",
        { resetTokenId }
      );

      const weak = await request(app)
        .post("/api/v1/forgot-password/reset")
        .set(auth(token))
        .send({ password: "12345678" });
      expect(weak.status).toBe(400);

      const strong = await request(app)
        .post("/api/v1/forgot-password/reset")
        .set(auth(token))
        .send({ password: "Val1d!Pass" });
      expect(strong.status).toBe(200);

      // Setting a password through an invite link is what activates the account.
      const activated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(activated.status).toBe("active");
      // And the link is spent.
      expect(activated.resetTokenId).toBeNull();
    });

    it("refuses a reset link a second time", async () => {
      const AuthService = require("../../src/services/auth").default;
      const crypto = require("crypto");
      const user = await createUser({ email: "reset2@test.local" });
      const resetTokenId = crypto.randomUUID();
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenId } });
      const { token } = AuthService.generateAccessToken(
        { id: user.id },
        "passwordReset",
        "900s",
        { resetTokenId }
      );

      const first = await request(app)
        .post("/api/v1/forgot-password/reset")
        .set(auth(token))
        .send({ password: "Val1d!Pass" });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post("/api/v1/forgot-password/reset")
        .set(auth(token))
        .send({ password: "An0ther!Pass" });
      expect(second.status).toBe(403);
    });
  });

  describe("session refresh", () => {
    it("issues a token that outlives the one it replaces", async () => {
      const jwt = require("jsonwebtoken");
      const user = await createUser({ email: "refresh@test.local" });
      const token = (await signIn(app, user.email))!;

      await new Promise((r) => setTimeout(r, 1100));
      const res = await request(app).post("/api/v1/auth/refresh").set(auth(token));
      expect(res.status).toBe(200);

      const before = jwt.decode(token);
      const after = jwt.decode(res.body.token);
      expect(after.exp).toBeGreaterThan(before.exp);
    });

    it("refuses to refresh without a valid session", async () => {
      expect((await request(app).post("/api/v1/auth/refresh")).status).toBe(401);
    });
  });
});
