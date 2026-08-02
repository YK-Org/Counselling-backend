-- AlterTable
ALTER TABLE "Couple" ADD COLUMN     "referenceCode" TEXT;

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "formSubmittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Couple_referenceCode_key" ON "Couple"("referenceCode");

