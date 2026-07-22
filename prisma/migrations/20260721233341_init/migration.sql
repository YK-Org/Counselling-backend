-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'headCounsellor', 'counsellor');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'banned', 'awaitingConfirmation');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'awaitingConfirmation',
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "tokenIssuedAt" INTEGER,
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Couple" (
    "id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "counsellorAccepted" TEXT,
    "letterFileId" TEXT,
    "letterFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "counsellorId" TEXT,

    CONSTRAINT "Couple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "hometown" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "education" JSONB,
    "profession" JSONB,
    "parents" JSONB,
    "partner" JSONB,
    "religion" JSONB,
    "siblings" JSONB,
    "otherInfo" JSONB,
    "churchAfterMarriage" TEXT,
    "orderOfBirth" TEXT,
    "coupleId" TEXT,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoupleLessonCompleted" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "dateCompleted" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoupleLessonCompleted_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "uploads" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "couplesId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "partnerId" TEXT,
    "coupleId" TEXT,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uploads" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_role_availability_idx" ON "User"("role", "availability");

-- CreateIndex
CREATE INDEX "Couple_counsellorId_idx" ON "Couple"("counsellorId");

-- CreateIndex
CREATE INDEX "Couple_completed_idx" ON "Couple"("completed");

-- CreateIndex
CREATE INDEX "Couple_counsellorId_completed_idx" ON "Couple"("counsellorId", "completed");

-- CreateIndex
CREATE INDEX "Couple_createdAt_idx" ON "Couple"("createdAt");

-- CreateIndex
CREATE INDEX "Couple_updatedAt_idx" ON "Couple"("updatedAt");

-- CreateIndex
CREATE INDEX "Partner_coupleId_idx" ON "Partner"("coupleId");

-- CreateIndex
CREATE INDEX "Partner_gender_idx" ON "Partner"("gender");

-- CreateIndex
CREATE INDEX "Partner_phoneNumber_idx" ON "Partner"("phoneNumber");

-- CreateIndex
CREATE INDEX "CoupleLessonCompleted_coupleId_idx" ON "CoupleLessonCompleted"("coupleId");

-- CreateIndex
CREATE UNIQUE INDEX "CoupleLessonCompleted_coupleId_lessonId_key" ON "CoupleLessonCompleted"("coupleId", "lessonId");

-- CreateIndex
CREATE INDEX "Assignment_couplesId_idx" ON "Assignment"("couplesId");

-- CreateIndex
CREATE INDEX "Questionnaire_partnerId_idx" ON "Questionnaire"("partnerId");

-- CreateIndex
CREATE INDEX "Questionnaire_coupleId_idx" ON "Questionnaire"("coupleId");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_questionnaireId_idx" ON "QuestionnaireResponse"("questionnaireId");

-- AddForeignKey
ALTER TABLE "Couple" ADD CONSTRAINT "Couple_counsellorId_fkey" FOREIGN KEY ("counsellorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoupleLessonCompleted" ADD CONSTRAINT "CoupleLessonCompleted_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoupleLessonCompleted" ADD CONSTRAINT "CoupleLessonCompleted_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_couplesId_fkey" FOREIGN KEY ("couplesId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
