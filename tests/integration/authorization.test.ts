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
} from "./setup";

// Every one of these covers a hole that was open in this codebase: the couples
// list returned every couple to any counsellor, the reports endpoints had no
// role guard at all, and the assignment routes checked nothing before letting
// one counsellor read, add to or delete another's files.

describeDb("authorization", () => {
  let app: any;
  let prisma: any;

  let headToken: string;
  let aliceToken: string;
  let alice: any;
  let bob: any;
  let aliceCouple: any;
  let bobCouple: any;
  let orphanCouple: any;

  beforeAll(() => {
    app = getApp();
    prisma = getPrisma();
  });

  afterAll(disconnect);

  beforeEach(async () => {
    await resetDatabase();

    const head = await createUser({ email: "head@test.local", role: "headCounsellor" });
    alice = await createUser({ email: "alice@test.local", role: "counsellor" });
    bob = await createUser({ email: "bob@test.local", role: "counsellor" });

    aliceCouple = await createCouple({ counsellorId: alice.id, referenceCode: "ACD-234" });
    bobCouple = await createCouple({ counsellorId: bob.id, referenceCode: "EFG-346" });
    orphanCouple = await createCouple({ referenceCode: "HJK-478" });

    headToken = (await signIn(app, head.email))!;
    aliceToken = (await signIn(app, alice.email))!;
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe("couples list", () => {
    it("returns only a counsellor's own couples", async () => {
      const res = await request(app).get("/api/v1/couples").set(auth(aliceToken));
      expect(res.status).toBe(200);
      expect(res.body.couples.map((c: any) => c.id)).toEqual([aliceCouple.id]);
    });

    it("returns every couple to a head counsellor", async () => {
      const res = await request(app).get("/api/v1/couples").set(auth(headToken));
      expect(res.body.couples.map((c: any) => c.id).sort()).toEqual(
        [aliceCouple.id, bobCouple.id, orphanCouple.id].sort()
      );
    });

    it("ignores a counsellor asking for another counsellor's couples", async () => {
      const res = await request(app)
        .get("/api/v1/couples")
        .query({ counsellorId: bob.id })
        .set(auth(aliceToken));
      expect(res.body.couples.map((c: any) => c.id)).toEqual([aliceCouple.id]);
    });

    it("ignores nested Prisma operators in the query string", async () => {
      // Was: ?partners[some][phoneNumber][contains]=0 enumerated counsellees.
      const res = await request(app)
        .get("/api/v1/couples?partners[some][name][contains]=Test")
        .set(auth(aliceToken));
      expect(res.status).toBe(200);
      expect(res.body.couples.map((c: any) => c.id)).toEqual([aliceCouple.id]);
    });

    it("refuses an unauthenticated request", async () => {
      expect((await request(app).get("/api/v1/couples")).status).toBe(401);
    });
  });

  describe("a single couple", () => {
    it("lets the assigned counsellor read it", async () => {
      const res = await request(app)
        .get(`/api/v1/couples/${aliceCouple.id}`)
        .set(auth(aliceToken));
      expect(res.status).toBe(200);
    });

    it("refuses another counsellor's couple", async () => {
      const res = await request(app)
        .get(`/api/v1/couples/${bobCouple.id}`)
        .set(auth(aliceToken));
      expect(res.status).toBe(403);
    });

    it("gives the same answer for a couple that does not exist", async () => {
      // Otherwise the difference tells a caller which ids are real.
      const res = await request(app)
        .get("/api/v1/couples/does-not-exist")
        .set(auth(aliceToken));
      expect(res.status).toBe(403);
    });

    it("lets a head counsellor read any couple", async () => {
      const res = await request(app)
        .get(`/api/v1/couples/${bobCouple.id}`)
        .set(auth(headToken));
      expect(res.status).toBe(200);
    });
  });

  describe("reports", () => {
    const endpoints = [
      "/api/v1/reports/counsellors/sessions",
      "/api/v1/reports/age",
      "/api/v1/reports/completed/sessions?startDate=2020-01-01&endDate=2030-01-01",
      "/api/v1/reports/couples/statistics?startDate=2020-01-01&endDate=2030-01-01",
      "/api/v1/reports/counsellors/statistics",
    ];

    it.each(endpoints)("refuses a counsellor: %s", async (url) => {
      expect((await request(app).get(url).set(auth(aliceToken))).status).toBe(403);
    });

    it.each(endpoints)("allows a head counsellor: %s", async (url) => {
      expect((await request(app).get(url).set(auth(headToken))).status).toBe(200);
    });
  });

  describe("assignments", () => {
    let lesson: any;

    beforeEach(async () => {
      lesson = await prisma.lesson.create({ data: { name: "Communication" } });
    });

    it("requires a couple to be named", async () => {
      // Was: no filter returned every assignment in the system.
      const res = await request(app).get("/api/v1/assignments").set(auth(aliceToken));
      expect(res.status).toBe(400);
    });

    it("refuses another counsellor's couple", async () => {
      const res = await request(app)
        .get("/api/v1/assignments")
        .query({ couplesId: bobCouple.id })
        .set(auth(aliceToken));
      expect(res.status).toBe(403);
    });

    it("returns only that couple's assignments", async () => {
      await prisma.assignment.create({
        data: { couplesId: aliceCouple.id, lessonId: lesson.id },
      });
      await prisma.assignment.create({
        data: { couplesId: bobCouple.id, lessonId: lesson.id },
      });

      const res = await request(app)
        .get("/api/v1/assignments")
        .query({ couplesId: aliceCouple.id })
        .set(auth(aliceToken));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].couplesId).toBe(aliceCouple.id);
    });

    it("refuses to create one against another counsellor's couple", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set(auth(aliceToken))
        .field("couplesId", bobCouple.id)
        .field("lessonId", lesson.id);
      expect(res.status).toBe(403);
    });

    it("refuses to delete another counsellor's assignment, and leaves it intact", async () => {
      // Deleting also destroyed the stored files behind it.
      const theirs = await prisma.assignment.create({
        data: { couplesId: bobCouple.id, lessonId: lesson.id },
      });

      const res = await request(app)
        .delete(`/api/v1/assignments/${theirs.id}`)
        .set(auth(aliceToken));
      expect(res.status).toBe(403);
      expect(await prisma.assignment.findUnique({ where: { id: theirs.id } })).not.toBeNull();
    });
  });

  describe("media downloads", () => {
    it("refuses a key belonging to another counsellor's couple", async () => {
      const key = "letters/01HXXXXXXXXXXXXXXXXXXXXXXX.pdf";
      await prisma.couple.update({
        where: { id: bobCouple.id },
        data: { letterFileId: key, letterFileName: "letter.pdf" },
      });

      const res = await request(app)
        .put("/api/v1/media")
        .set(auth(aliceToken))
        .send({ mediaIds: [key] });
      expect(res.status).toBe(403);
    });

    it("refuses a key that belongs to nothing", async () => {
      const res = await request(app)
        .put("/api/v1/media")
        .set(auth(aliceToken))
        .send({ mediaIds: ["letters/made-up-key.pdf"] });
      expect(res.status).toBe(403);
    });

    it("refuses the whole request when one key of several is not permitted", async () => {
      // Filtering instead would let a caller probe which keys exist.
      const mine = "letters/01HAAAAAAAAAAAAAAAAAAAAAAA.pdf";
      const theirs = "letters/01HBBBBBBBBBBBBBBBBBBBBBBB.pdf";
      await prisma.couple.update({
        where: { id: aliceCouple.id },
        data: { letterFileId: mine },
      });
      await prisma.couple.update({
        where: { id: bobCouple.id },
        data: { letterFileId: theirs },
      });

      const res = await request(app)
        .put("/api/v1/media")
        .set(auth(aliceToken))
        .send({ mediaIds: [mine, theirs] });
      expect(res.status).toBe(403);
    });

    it("refuses a profile-picture key, which has its own endpoint and rules", async () => {
      const res = await request(app)
        .put("/api/v1/media")
        .set(auth(aliceToken))
        .send({ mediaIds: ["profile-pictures/01HCCCCCCCCCCCCCCCCCCCCCCC.png"] });
      expect(res.status).toBe(403);
    });
  });

  describe("head-counsellor-only endpoints", () => {
    const headOnly: [string, string][] = [
      ["get", "/api/v1/counsellors"],
      ["get", "/api/v1/dashboard/init"],
      ["get", "/api/v1/couples/unassigned"],
      ["get", "/api/v1/couples/submissions/outstanding"],
      ["get", "/api/v1/audit-logs"],
    ];

    it.each(headOnly)("refuses a counsellor: %s %s", async (method, url) => {
      const res = await (request(app) as any)[method](url).set(auth(aliceToken));
      expect(res.status).toBe(403);
    });

    it("refuses a counsellor registering a couple", async () => {
      const res = await request(app)
        .post("/api/v1/couples")
        .set(auth(aliceToken))
        .field("manName", "A")
        .field("womanName", "B");
      expect(res.status).toBe(403);
    });
  });
});
