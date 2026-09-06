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

// How a form submission finds the person it belongs to. A wrong answer here
// attaches one partner's account of sexual history, abuse and health to the
// other, so the important property is not just that matching works — it is
// that ambiguity is refused rather than guessed at.

describeDb("matching form submissions to people", () => {
  let app: any;
  let prisma: any;
  let couple: any;

  let warn: jest.SpyInstance;

  beforeAll(() => {
    app = getApp();
    prisma = getPrisma();
    // requireFormSecret warns on every request while FORM_SHARED_SECRET is
    // unset. That is correct behaviour and deliberately exercised below, but
    // it drowns the test output.
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterAll(async () => {
    warn.mockRestore();
    await disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
    couple = await createCouple({
      referenceCode: "ACD-234",
      manName: "Kofi Mensah",
      womanName: "Adjoa Mensah",
      manPhone: "+233244000111",
      womanPhone: "+233244000222",
      manFormIn: false,
      womanFormIn: false,
    });
  });

  const partners = () =>
    prisma.partner.findMany({ where: { coupleId: couple.id }, orderBy: { gender: "asc" } });

  describe("questionnaires", () => {
    const submit = (body: any, type = "pre-test") =>
      request(app).post(`/api/v1/questionnaire/${type}`).send(body);

    it("uses the reference code and gender, with no usable phone number", async () => {
      // The point of the design: a respondent who types a different number
      // from the one on file is still attached to the right person.
      const res = await submit({
        "Reference Code": "acd234",
        Gender: "Female",
        "Tel. No": "+233209999999",
        Q1: "yes",
      });
      expect(res.status).toBe(201);
      expect(res.body.matched).toBe(true);

      const [, woman] = await partners();
      const stored = await prisma.questionnaire.findFirst();
      expect(stored.partnerId).toBe(woman.id);
      expect(stored.coupleId).toBe(couple.id);
    });

    it("accepts husband/wife wording as well as male/female", async () => {
      const res = await submit({
        "Reference Code": "ACD-234",
        "Are you the husband or wife?": "Husband",
        Q1: "yes",
      });
      expect(res.body.matched).toBe(true);
      const [man] = await partners();
      expect((await prisma.questionnaire.findFirst()).partnerId).toBe(man.id);
    });

    it("matches titles regardless of case, spacing and punctuation", async () => {
      // The live intake form has questions titled "Tel. No" and
      // "Profession/Occupation", so exact title matching was never workable.
      const res = await submit({
        "REFERENCE CODE": "ACD-234",
        "Are you the husband or wife": "Wife",
        "Tel.No": "0244000222",
        Q1: "yes",
      });
      expect(res.body.matched).toBe(true);
    });

    it("queues rather than guessing when gender and phone disagree", async () => {
      // Gender says the wife; the number on file is the husband's. Picking
      // either would risk attributing one spouse's answers to the other.
      const res = await submit({
        "Reference Code": "ACD-234",
        Gender: "Female",
        "Tel. No": "+233244000111",
        Q1: "yes",
      });
      expect(res.body.matched).toBe(false);
      expect(res.body.reason).toBe("ambiguous-partner");

      const stored = await prisma.questionnaire.findFirst();
      expect(stored.partnerId).toBeNull();
      // The couple is still known, which is most of what a person needs.
      expect(stored.coupleId).toBe(couple.id);
    });

    it("queues when the code matches but nothing identifies the partner", async () => {
      const res = await submit({ "Reference Code": "ACD-234", Q1: "yes" });
      expect(res.body.matched).toBe(false);
      expect(res.body.reason).toBe("partner-not-identified");
      expect((await prisma.questionnaire.findFirst()).coupleId).toBe(couple.id);
    });

    it("queues an unknown code, keeping the answers", async () => {
      const res = await submit({
        "Reference Code": "ZZZ-999",
        "Tel. No": "+233551234567",
        Q1: "yes",
      });
      expect(res.body.matched).toBe(false);
      expect(res.body.reason).toBe("no-code-match");

      const stored = await prisma.questionnaire.findFirst({ include: { responses: true } });
      expect(stored.coupleId).toBeNull();
      // Never discarded — the answers are still there to be attached by hand.
      expect(stored.responses).toHaveLength(1);
    });

    it("keeps what the respondent typed, so a queued entry can be identified", async () => {
      // These were stripped before the answers were stored, leaving an
      // unmatched row as an anonymous list of answers nobody could place.
      await submit({
        "Reference Code": "ZZZ-999",
        Name: "Ama Mensah",
        "Tel. No": "0244000222",
        Gender: "Female",
        Q1: "yes",
      });
      const stored = await prisma.questionnaire.findFirst();
      expect(stored.submittedName).toBe("Ama Mensah");
      expect(stored.submittedReferenceCode).toBe("ZZZ-999");
      expect(stored.submittedGender).toBe("Female");
      expect(stored.submittedContact).toBe("0244000222");
    });

    it("does not store identifying fields as if they were answers", async () => {
      await submit({
        "Reference Code": "ACD-234",
        Gender: "Male",
        Name: "Kofi",
        "Tel. No": "0244000111",
        "How happy are you?": "Very",
      });
      const stored = await prisma.questionnaire.findFirst({ include: { responses: true } });
      expect(stored.responses.map((r: any) => r.question)).toEqual(["How happy are you?"]);
    });

    it("falls back to phone when no code is given, as older forms do", async () => {
      const res = await submit({ "Tel. No": "0244000111", Q1: "yes" });
      expect(res.body.matched).toBe(true);
      const [man] = await partners();
      expect((await prisma.questionnaire.findFirst()).partnerId).toBe(man.id);
    });

    it("rejects a submission carrying no identifier at all", async () => {
      expect((await submit({ Q1: "yes" })).status).toBe(400);
    });

    it("keeps pre-test and post-test apart", async () => {
      await submit({ "Reference Code": "ACD-234", Gender: "Male", Q1: "before" }, "pre-test");
      await submit({ "Reference Code": "ACD-234", Gender: "Male", Q1: "after" }, "post-test");

      const head = await createUser({ email: "h@test.local", role: "headCounsellor" });
      const token = await signIn(app, head.email);

      const pre = await request(app)
        .get(`/api/v1/questionnaire/couples/${couple.id}/pre-test`)
        .set({ Authorization: `Bearer ${token}` });
      expect(pre.body).toHaveLength(1);
      expect(pre.body[0].response[0].answer).toBe("before");

      const post = await request(app)
        .get(`/api/v1/questionnaire/couples/${couple.id}/post-test`)
        .set({ Authorization: `Bearer ${token}` });
      expect(post.body).toHaveLength(1);
      expect(post.body[0].response[0].answer).toBe("after");
    });
  });

  describe("the queue for submissions needing a person", () => {
    it("lists unlinked questionnaires with the couple's two candidates", async () => {
      await request(app)
        .post("/api/v1/questionnaire/pre-test")
        .send({ "Reference Code": "ACD-234", Q1: "yes" });

      const head = await createUser({ email: "h2@test.local", role: "headCounsellor" });
      const token = await signIn(app, head.email);

      const res = await request(app)
        .get("/api/v1/couples/submissions/outstanding")
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.unlinkedQuestionnaires).toHaveLength(1);
      expect(res.body.unlinkedQuestionnaires[0].couple.partners).toHaveLength(2);
    });

    it("attaches a queued submission to a partner and makes it visible", async () => {
      await request(app)
        .post("/api/v1/questionnaire/pre-test")
        .send({ "Reference Code": "ACD-234", Q1: "yes" });
      const queued = await prisma.questionnaire.findFirst();
      const [, woman] = await partners();

      const head = await createUser({ email: "h3@test.local", role: "headCounsellor" });
      const token = await signIn(app, head.email);
      const auth = { Authorization: `Bearer ${token}` };

      const res = await request(app)
        .put(`/api/v1/questionnaire/${queued.id}/link`)
        .set(auth)
        .send({ partnerId: woman.id });
      expect(res.status).toBe(200);

      const linked = await prisma.questionnaire.findUnique({ where: { id: queued.id } });
      expect(linked.partnerId).toBe(woman.id);
      expect(linked.coupleId).toBe(couple.id);

      // The app reads questionnaires through the partner, so this is what
      // makes it appear on the couple's page at all.
      const detail = await request(app).get(`/api/v1/couples/${couple.id}`).set(auth);
      const her = detail.body.couplesInfo.find((p: any) => p.gender === "female");
      expect(her.questionnaire).toHaveLength(1);
    });

    it("refuses to attach the same submission twice", async () => {
      await request(app)
        .post("/api/v1/questionnaire/pre-test")
        .send({ "Reference Code": "ACD-234", Q1: "yes" });
      const queued = await prisma.questionnaire.findFirst();
      const [man, woman] = await partners();

      const head = await createUser({ email: "h4@test.local", role: "headCounsellor" });
      const token = await signIn(app, head.email);
      const auth = { Authorization: `Bearer ${token}` };

      await request(app)
        .put(`/api/v1/questionnaire/${queued.id}/link`)
        .set(auth)
        .send({ partnerId: woman.id });

      const second = await request(app)
        .put(`/api/v1/questionnaire/${queued.id}/link`)
        .set(auth)
        .send({ partnerId: man.id });
      expect(second.status).toBe(400);
      expect(second.body.message).toContain("already linked");
    });

    it("does not let a counsellor attach submissions", async () => {
      const counsellor = await createUser({ email: "c@test.local", role: "counsellor" });
      const token = await signIn(app, counsellor.email);
      const res = await request(app)
        .put("/api/v1/questionnaire/whatever/link")
        .set({ Authorization: `Bearer ${token}` })
        .send({ partnerId: "x" });
      expect(res.status).toBe(403);
    });
  });

  describe("the shared secret on counsellee-facing endpoints", () => {
    // These are filled in by people with no account, so they cannot sit behind
    // a login. The secret is what stops anyone who finds the URL writing to
    // them. It fails open by design, so that deploying cannot take a live
    // Google Form offline — which makes it worth pinning both halves.
    afterEach(() => {
      process.env.FORM_SHARED_SECRET = "";
    });

    it("accepts unauthenticated writes while unset, and says so", () => {
      // Empty and absent both mean unset to the middleware.
      expect(process.env.FORM_SHARED_SECRET).toBeFalsy();
      return request(app)
        .post("/api/v1/questionnaire/pre-test")
        .send({ "Reference Code": "ACD-234", Gender: "Male", Q1: "yes" })
        .expect(201);
    });

    it("rejects a submission with no header once set", async () => {
      process.env.FORM_SHARED_SECRET = "s3cret-value";
      const res = await request(app)
        .post("/api/v1/questionnaire/pre-test")
        .send({ "Reference Code": "ACD-234", Gender: "Male", Q1: "yes" });
      expect(res.status).toBe(403);
    });

    it("rejects a wrong header", async () => {
      process.env.FORM_SHARED_SECRET = "s3cret-value";
      const res = await request(app)
        .post("/api/v1/couples/details")
        .set("X-Form-Secret", "not-the-secret")
        .send({ ReferenceCode: "ACD-234", Gender: "Male" });
      expect(res.status).toBe(403);
    });

    it("accepts the right header", async () => {
      process.env.FORM_SHARED_SECRET = "s3cret-value";
      const res = await request(app)
        .post("/api/v1/questionnaire/pre-test")
        .set("X-Form-Secret", "s3cret-value")
        .send({ "Reference Code": "ACD-234", Gender: "Male", Q1: "yes" });
      expect(res.status).toBe(201);
    });

    it("does not leak the expected value in the refusal", async () => {
      process.env.FORM_SHARED_SECRET = "s3cret-value";
      const res = await request(app)
        .post("/api/v1/questionnaire/pre-test")
        .set("X-Form-Secret", "wrong")
        .send({ Q1: "yes" });
      expect(JSON.stringify(res.body)).not.toContain("s3cret-value");
      expect(res.body.message).toBe("Forbidden");
    });
  });

  describe("intake forms", () => {
    it("fills the slot the code and gender identify", async () => {
      const res = await request(app).post("/api/v1/couples/details").send({
        ReferenceCode: "ACD-234",
        Gender: "Female",
        TelNo: "+233244000222",
        FullName: "Adjoa Mensah",
      });
      expect(res.status).toBe(201);
      expect(res.body.matched).toBe(true);

      const [, woman] = await partners();
      expect(woman.formSubmittedAt).not.toBeNull();
      // And the husband's slot is untouched.
      const [man] = await partners();
      expect(man.formSubmittedAt).toBeNull();
    });

    it("lets the same person resubmit to correct their own answers", async () => {
      const send = (town: string) =>
        request(app).post("/api/v1/couples/details").send({
          ReferenceCode: "ACD-234",
          Gender: "Male",
          TelNo: "+233244000111",
          FullName: "Kofi Mensah",
          HomeTown: town,
        });

      await send("Cape Coast");
      await send("Takoradi");

      const [man] = await partners();
      expect(man.hometown).toBe("Takoradi");
      expect(await prisma.partner.count({ where: { coupleId: couple.id } })).toBe(2);
    });
  });
});
