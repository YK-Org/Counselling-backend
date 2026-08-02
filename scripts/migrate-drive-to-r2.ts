// One-off migration: copy every file still referenced in the database from
// Google Drive into R2, then rewrite the stored references.
//
//   npx ts-node scripts/migrate-drive-to-r2.ts --dry-run
//   npx ts-node scripts/migrate-drive-to-r2.ts
//
// Safe to re-run: a reference that already looks like an R2 key (it contains a
// "/" prefix, which Drive ids never do) is skipped, so an interrupted run can
// simply be started again. Nothing is deleted from Drive — verify first, then
// clean up separately.
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import MediaService from "../src/services/media";
import StorageService, { UploadType } from "../src/services/storage";

dotenv.config();

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

// Drive ids are flat opaque strings; R2 keys are always "<prefix>/<ulid>.<ext>".
const isAlreadyMigrated = (reference: string) => reference.includes("/");

type Upload = { id: string; name: string };

async function downloadFromDrive(fileId: string) {
  const auth = await MediaService.authorize();
  const drive = google.drive({ version: "v3", auth });

  const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
  const media = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return {
    name: meta.data.name || fileId,
    mimeType: meta.data.mimeType || "application/octet-stream",
    body: Buffer.from(media.data as ArrayBuffer),
  };
}

async function migrateReference(fileId: string, uploadType: UploadType) {
  const file = await downloadFromDrive(fileId);

  // Drive names were stored as "<multerName>/<originalName>"; the trailing
  // segment is the name a person would recognise.
  const originalName = file.name.split("/").pop() || file.name;
  const key = StorageService.buildKey(uploadType, originalName);

  if (dryRun) {
    console.log(
      `  would copy ${fileId} -> ${key} (${originalName}, ${file.body.length} bytes)`
    );
    return { key, originalName };
  }

  await StorageService.putBuffer(key, file.body, file.mimeType);
  console.log(`  copied ${fileId} -> ${key} (${file.body.length} bytes)`);
  return { key, originalName };
}

async function migrateUploads(uploads: Upload[], uploadType: UploadType) {
  const migrated: Upload[] = [];
  let changed = false;

  for (const upload of uploads) {
    if (!upload?.id || isAlreadyMigrated(upload.id)) {
      migrated.push(upload);
      continue;
    }
    const { key, originalName } = await migrateReference(upload.id, uploadType);
    migrated.push({ id: key, name: upload.name || originalName });
    changed = true;
  }

  return { migrated, changed };
}

async function main() {
  console.log(dryRun ? "DRY RUN — nothing will be written\n" : "Migrating\n");

  console.log("Profile pictures:");
  const users = await prisma.user.findMany({
    where: { profilePicture: { not: null } },
  });
  for (const user of users) {
    const reference = user.profilePicture as string;
    if (isAlreadyMigrated(reference)) {
      console.log(`  ${user.email}: already migrated`);
      continue;
    }
    const { key } = await migrateReference(reference, "profile-pictures");
    if (!dryRun) {
      await prisma.user.update({
        where: { id: user.id },
        data: { profilePicture: key },
      });
    }
  }
  if (!users.length) console.log("  none");

  console.log("\nCouple letters:");
  const couples = await prisma.couple.findMany({
    where: { letterFileId: { not: null } },
  });
  for (const couple of couples) {
    const reference = couple.letterFileId as string;
    if (isAlreadyMigrated(reference)) {
      console.log(`  ${couple.id}: already migrated`);
      continue;
    }
    const { key, originalName } = await migrateReference(reference, "letters");
    if (!dryRun) {
      await prisma.couple.update({
        where: { id: couple.id },
        data: { letterFileId: key, letterFileName: couple.letterFileName || originalName },
      });
    }
  }
  if (!couples.length) console.log("  none");

  console.log("\nAssignments:");
  const assignments = await prisma.assignment.findMany();
  for (const assignment of assignments) {
    const uploads = (assignment.uploads as unknown as Upload[]) || [];
    if (!uploads.length) continue;
    const { migrated, changed } = await migrateUploads(uploads, "assignments");
    if (changed && !dryRun) {
      await prisma.assignment.update({
        where: { id: assignment.id },
        data: { uploads: migrated as any },
      });
    }
  }
  if (!assignments.length) console.log("  none");

  console.log("\nResources:");
  const resources = await prisma.resource.findMany();
  for (const resource of resources) {
    const uploads = (resource.uploads as unknown as Upload[]) || [];
    if (!uploads.length) continue;
    const { migrated, changed } = await migrateUploads(uploads, "resources");
    if (changed && !dryRun) {
      await prisma.resource.update({
        where: { id: resource.id },
        data: { uploads: migrated as any },
      });
    }
  }
  if (!resources.length) console.log("  none");

  console.log(
    dryRun
      ? "\nDry run complete. Re-run without --dry-run to apply."
      : "\nMigration complete. Verify downloads before deleting anything from Drive."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
