// Demo data for exercising the app end to end.
//
// Every record created here has an id beginning `demo-`, which is what makes
// this both re-runnable and reversible: seeding upserts by that id, and
// `npm run demo:clear` deletes exactly those rows and nothing else. Real
// records get cuid() ids and can never collide with them.
//
//   npm run demo:seed    create or refresh the demo data
//   npm run demo:clear   remove all of it
//
// The couples below are deliberately in different states, so every screen and
// queue in the app has something to show.
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo12345";
const PREFIX = "demo-";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// A full personal-history profile. The couple detail page reads these through
// dot-paths (see src/helpers/formatQuestions.ts on the frontend), so the shape
// matters more than the values — a partial object shows as blank rows.
const profile = (o: {
  partnerName: string;
  partnerPhone: string;
  town: string;
  job: string;
  workplace: string;
  motherName: string;
  fatherName: string;
}) => ({
  education: { level: "Graduate", certificate: "BSc Administration" },
  profession: { type: o.job, placeOfWork: o.workplace },
  parents: {
    mother: {
      name: o.motherName,
      hometown: o.town,
      profession: { type: "Trader", placeOfWork: "Makola Market" },
    },
    father: {
      name: o.fatherName,
      hometown: o.town,
      profession: { type: "Teacher", placeOfWork: "Accra High School" },
    },
  },
  religion: {
    grewUp: "Christianity",
    current: "Christianity",
    denomination: "Methodist",
  },
  siblings: { numberOfSiblings: "3", ages: "34 M, 31 F, 27 M" },
  partner: {
    name: o.partnerName,
    phoneNumber: o.partnerPhone,
    hometown: o.town,
    education: { level: "Graduate", certificate: "BA Sociology" },
    profession: { type: "Nurse", placeOfWork: "Korle Bu Teaching Hospital" },
    religion: { grewUp: "Christianity", current: "Christianity", denomination: "Methodist" },
    orderOfBirth: "Second",
  },
  otherInfo: {
    perceptionAboutSelf: "Confident and steady",
    hapinessOverYears: "Generally happy",
    parentsAlive: true,
    marriedBefore: false,
    haveChildren: false,
    divorceInFamily: false,
    everDivorced: false,
    meetingPartner: "We met through the church youth fellowship in 2022.",
    decisionForMarriage: "After two years of courtship and counselling.",
    parentsConsentMarriage: true,
    marriageTiming: "December 2026",
    residenceAfterMarriage: "Accra",
    otherSourceOfIncome: false,
    financialResponsibility: "Shared, with agreed monthly contributions",
    numberOfChildrenWish: "3",
    marriageSuccess: "Very confident",
    areasHelpNeeded: "Communication,Finances",
    healthStatus: "Good",
    sexRelationshipMaterials: true,
    sexualAssault: { victim: false, partnerAware: false },
    abuse: { abusedAnyone: false, partnerAware: false },
    fitForProcreation: true,
    helpTalkToPartner: true,
  },
  churchAfterMarriage: "Trinity United Church, Legon",
  orderOfBirth: "First",
});

const PRE_TEST = [
  ["How well do you feel you communicate with your partner?", "Fairly well"],
  ["How do you handle disagreements?", "We talk it through, sometimes after a pause"],
  ["Have you discussed finances in detail?", "Yes"],
  ["What are your expectations about children?", "Three, starting after two years"],
  ["How confident are you about this marriage?", "Very confident"],
];

const POST_TEST = [
  ["How well do you feel you communicate with your partner?", "Much better than before"],
  ["How do you handle disagreements?", "We pause, then address it the same day"],
  ["Have you discussed finances in detail?", "Yes, we now budget together monthly"],
  ["What are your expectations about children?", "Three, and we agree on the timing"],
  ["How confident are you about this marriage?", "Very confident"],
];

async function clearDemo() {
  // Ordered by dependency: questionnaires and their responses first, then the
  // rows that reference couples, then the couples themselves.
  const where = { id: { startsWith: PREFIX } };

  await prisma.questionnaireResponse.deleteMany({
    where: { questionnaire: { id: { startsWith: PREFIX } } },
  });
  await prisma.questionnaire.deleteMany({ where });
  await prisma.assignment.deleteMany({ where });
  await prisma.coupleLessonCompleted.deleteMany({ where });
  await prisma.partner.deleteMany({ where });
  await prisma.couple.deleteMany({ where });
  await prisma.lesson.deleteMany({ where });
  await prisma.form.deleteMany({ where });
  await prisma.resource.deleteMany({ where });
  await prisma.user.deleteMany({ where });
}

async function main() {
  const clearOnly = process.argv.includes("--clear");

  await clearDemo();
  if (clearOnly) {
    console.log("Demo data removed.");
    return;
  }

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- counsellors -------------------------------------------------------
  const counsellors = [
    { id: "demo-counsellor-1", firstName: "Ama", lastName: "Boateng", availability: true },
    { id: "demo-counsellor-2", firstName: "Kwame", lastName: "Asante", availability: true },
    { id: "demo-counsellor-3", firstName: "Efua", lastName: "Mensah", availability: false },
  ];
  for (const c of counsellors) {
    await prisma.user.create({
      data: {
        ...c,
        // .invalid can never be a real domain, so a stray invite cannot reach
        // anyone by accident.
        email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@demo.invalid`,
        password,
        role: "counsellor",
        status: "active",
        phoneNumber: "+233244000001",
      },
    });
  }

  // --- lessons -----------------------------------------------------------
  const lessonNames = [
    "Communication",
    "Finances and Budgeting",
    "Conflict Resolution",
    "Intimacy and Expectations",
    "Family and In-laws",
    "Spiritual Life Together",
  ];
  const lessons = [];
  for (let i = 0; i < lessonNames.length; i++) {
    lessons.push(
      await prisma.lesson.create({
        data: { id: `demo-lesson-${i + 1}`, name: lessonNames[i] },
      })
    );
  }

  // --- couples -----------------------------------------------------------
  type Spec = {
    n: number;
    code: string;
    man: string;
    woman: string;
    counsellorId?: string;
    accepted?: string;
    lessonsDone: number;
    completed?: boolean;
    womanFormIn?: boolean;
    createdDaysAgo: number;
    preTest?: boolean;
    postTest?: boolean;
    assignments?: number;
  };

  const specs: Spec[] = [
    // Furthest along: everything filled in, both tests done.
    { n: 1, code: "ACD-234", man: "Kofi Mensah", woman: "Adjoa Mensah",
      counsellorId: "demo-counsellor-1", accepted: "accept", lessonsDone: 5,
      createdDaysAgo: 150, preTest: true, postTest: true, assignments: 2 },
    // Mid-programme.
    { n: 2, code: "EFG-346", man: "Yaw Owusu", woman: "Akosua Owusu",
      counsellorId: "demo-counsellor-2", accepted: "accept", lessonsDone: 2,
      createdDaysAgo: 60, preTest: true, assignments: 1 },
    // Assigned but the counsellor has not accepted — shows on their dashboard.
    { n: 3, code: "HJK-478", man: "Kojo Antwi", woman: "Abena Antwi",
      counsellorId: "demo-counsellor-1", accepted: "", lessonsDone: 0,
      createdDaysAgo: 10, preTest: true },
    // Waiting to be assigned — shows on the head counsellor's dashboard.
    { n: 4, code: "MNP-692", man: "Kwesi Darko", woman: "Esi Darko",
      lessonsDone: 0, createdDaysAgo: 5, preTest: true },
    // Registered, but the wife has not sent her form in — outstanding queue.
    { n: 5, code: "QRT-723", man: "Fiifi Amoah", woman: "Maame Amoah",
      lessonsDone: 0, createdDaysAgo: 3, womanFormIn: false },
    // Finished the programme — feeds the completed-sessions reports.
    { n: 6, code: "UVW-849", man: "Nii Tetteh", woman: "Naa Tetteh",
      counsellorId: "demo-counsellor-2", accepted: "accept", lessonsDone: 6,
      completed: true, createdDaysAgo: 220, preTest: true, postTest: true },
  ];

  for (const s of specs) {
    const created = daysAgo(s.createdDaysAgo);
    const couple = await prisma.couple.create({
      data: {
        id: `demo-couple-${s.n}`,
        referenceCode: s.code,
        completed: Boolean(s.completed),
        counsellorId: s.counsellorId ?? null,
        counsellorAccepted: s.accepted ?? null,
        createdAt: created,
        updatedAt: created,
      },
    });

    const womanFormIn = s.womanFormIn !== false;

    const man = await prisma.partner.create({
      data: {
        id: `demo-partner-${s.n}m`,
        coupleId: couple.id,
        name: s.man,
        gender: "male",
        phoneNumber: `+2332440001${String(s.n).padStart(2, "0")}`,
        dateOfBirth: new Date("1993-04-18"),
        hometown: "Cape Coast",
        formSubmittedAt: created,
        createdAt: created,
        updatedAt: created,
        ...profile({
          partnerName: s.woman,
          partnerPhone: `+2332440002${String(s.n).padStart(2, "0")}`,
          town: "Cape Coast",
          job: "Accountant",
          workplace: "Ghana Revenue Authority",
          motherName: "Grace Mensah",
          fatherName: "Samuel Mensah",
        }),
      },
    });

    const woman = await prisma.partner.create({
      data: {
        id: `demo-partner-${s.n}f`,
        coupleId: couple.id,
        name: s.woman,
        gender: "female",
        phoneNumber: `+2332440002${String(s.n).padStart(2, "0")}`,
        dateOfBirth: new Date("1995-09-02"),
        hometown: "Koforidua",
        // Null is what the dashboard chases up as an outstanding form.
        formSubmittedAt: womanFormIn ? created : null,
        createdAt: created,
        updatedAt: created,
        ...(womanFormIn
          ? profile({
              partnerName: s.man,
              partnerPhone: `+2332440001${String(s.n).padStart(2, "0")}`,
              town: "Koforidua",
              job: "Nurse",
              workplace: "Korle Bu Teaching Hospital",
              motherName: "Comfort Asare",
              fatherName: "Daniel Asare",
            })
          : {}),
      },
    });

    for (let i = 0; i < s.lessonsDone; i++) {
      await prisma.coupleLessonCompleted.create({
        data: {
          id: `demo-clc-${s.n}-${i + 1}`,
          coupleId: couple.id,
          lessonId: lessons[i].id,
          dateCompleted: daysAgo(s.createdDaysAgo - (i + 1) * 7),
        },
      });
    }

    for (let i = 0; i < (s.assignments || 0); i++) {
      await prisma.assignment.create({
        data: {
          id: `demo-assignment-${s.n}-${i + 1}`,
          couplesId: couple.id,
          lessonId: lessons[i].id,
          // No uploads: the keys would point at objects that do not exist in
          // R2, and every download would fail.
          createdAt: daysAgo(s.createdDaysAgo - (i + 1) * 7),
          updatedAt: daysAgo(s.createdDaysAgo - (i + 1) * 7),
        },
      });
    }

    const addQuestionnaire = async (
      suffix: string,
      type: "pre-test" | "post-test",
      partnerId: string,
      rows: string[][],
      when: Date
    ) => {
      await prisma.questionnaire.create({
        data: {
          id: `demo-q-${s.n}${suffix}`,
          type,
          partnerId,
          coupleId: couple.id,
          submittedContact: null,
          createdAt: when,
          updatedAt: when,
          responses: {
            create: rows.map(([question, answer]) => ({ question, answer })),
          },
        },
      });
    };

    if (s.preTest) {
      await addQuestionnaire("m-pre", "pre-test", man.id, PRE_TEST, created);
      if (womanFormIn) {
        await addQuestionnaire("f-pre", "pre-test", woman.id, PRE_TEST, created);
      }
    }
    if (s.postTest) {
      const when = daysAgo(Math.max(1, s.createdDaysAgo - 120));
      await addQuestionnaire("m-post", "post-test", man.id, POST_TEST, when);
      await addQuestionnaire("f-post", "post-test", woman.id, POST_TEST, when);
    }
  }

  // --- things needing a human ------------------------------------------
  // An intake form that matched no couple: shows under "Unmatched forms".
  await prisma.partner.create({
    data: {
      id: "demo-partner-orphan",
      name: "Selina Owusu",
      gender: "female",
      phoneNumber: "+233209876543",
      dateOfBirth: new Date("1996-01-11"),
      hometown: "Takoradi",
      formSubmittedAt: daysAgo(2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
      ...profile({
        partnerName: "Unknown Partner",
        partnerPhone: "+233209876000",
        town: "Takoradi",
        job: "Teacher",
        workplace: "Takoradi SHS",
        motherName: "Mary Owusu",
        fatherName: "Joseph Owusu",
      }),
    },
  });

  // A questionnaire whose code matched a couple but whose respondent is
  // ambiguous — the "needs a name" queue, two-way choice.
  await prisma.questionnaire.create({
    data: {
      id: "demo-q-ambiguous",
      type: "pre-test",
      partnerId: null,
      coupleId: "demo-couple-2",
      submittedContact: "+233201112222",
      submittedName: "Y. Owusu",
      submittedReferenceCode: "EFG-346",
      submittedGender: "Wife",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      responses: { create: PRE_TEST.map(([question, answer]) => ({ question, answer })) },
    },
  });

  // A questionnaire that matched nothing at all.
  await prisma.questionnaire.create({
    data: {
      id: "demo-q-unmatched",
      type: "post-test",
      partnerId: null,
      coupleId: null,
      submittedContact: "+233551234567",
      submittedName: "Anonymous Respondent",
      submittedReferenceCode: "ZZZ-999",
      submittedGender: "Husband",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      responses: { create: POST_TEST.map(([question, answer]) => ({ question, answer })) },
    },
  });

  // --- forms and resources ---------------------------------------------
  await prisma.form.create({
    data: {
      id: "demo-form-1",
      name: "Intake / Personal History Form",
      link: "https://docs.google.com/forms/d/e/1FAIpQLSenV_gWWiTyqTFrWGiuysH1Rrg4mC3_WxjSG8hhkwHzUTBDZg/viewform",
    },
  });
  await prisma.form.create({
    data: {
      id: "demo-form-2",
      name: "Pre-test Questionnaire",
      link: "https://docs.google.com/forms/d/e/EXAMPLE_PRE_TEST/viewform",
    },
  });

  // No uploads, for the same reason as the assignments above.
  await prisma.resource.create({
    data: { id: "demo-resource-1", name: "Marriage Preparation Handbook" },
  });
  await prisma.resource.create({
    data: { id: "demo-resource-2", name: "Budgeting Worksheet for Couples" },
  });

  const counts = {
    counsellors: await prisma.user.count({ where: { role: "counsellor" } }),
    couples: await prisma.couple.count(),
    partners: await prisma.partner.count(),
    lessons: await prisma.lesson.count(),
    assignments: await prisma.assignment.count(),
    questionnaires: await prisma.questionnaire.count(),
  };

  console.log("Demo data created:", counts);
  console.log(`Demo counsellors sign in with password: ${DEMO_PASSWORD}`);
  console.log("Remove it all with: npm run demo:clear");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
