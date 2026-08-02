import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "fs";
import * as fs from "fs/promises";
import { extension, lookup } from "mime-types";
import { ulid } from "ulid";
import path from "path";
import { Readable } from "stream";

// How long a signed URL stays valid. Long enough to load a page and render its
// images, short enough that a leaked URL is not a lasting exposure — these are
// counselling records, and a signed URL is a bearer token for one object.
const SIGNED_URL_TTL_SECONDS = 600;

// Prefixes stand in for the old Drive folders. Objects are addressed by key, so
// the "folder" is just the first path segment.
export type UploadType =
  | "assignments"
  | "lessons"
  | "letters"
  | "profile-pictures"
  | "resources";

class StorageService {
  private client: S3Client | null = null;

  private config() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        "R2 is not configured: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET must be set"
      );
    }

    return { accountId, accessKeyId, secretAccessKey, bucket };
  }

  // Built lazily so importing this module does not require configuration —
  // the seed script and migrations import the app without touching storage.
  private getClient() {
    if (this.client) return this.client;

    const { accountId, accessKeyId, secretAccessKey } = this.config();

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    return this.client;
  }

  private bucket() {
    return this.config().bucket;
  }

  // Keys are opaque and unguessable. The original filename is kept in metadata
  // and in the database, never in the key — a key derived from a user-supplied
  // name would be both a path-traversal risk and a way to guess other objects.
  buildKey(uploadType: UploadType, originalName: string) {
    const fromName = path.extname(originalName).slice(1).toLowerCase();
    const fromMime = extension(lookup(originalName) || "") || "";
    const ext = fromName || fromMime;
    return `${uploadType}/${ulid()}${ext ? `.${ext}` : ""}`;
  }

  async uploadFiles(
    files: any[],
    uploadType: UploadType
  ): Promise<{ id: string; name: string }[]> {
    const uploaded: { id: string; name: string }[] = [];

    for (const file of files) {
      const key = this.buildKey(uploadType, file.originalname || file.filename);

      await this.getClient().send(
        new PutObjectCommand({
          Bucket: this.bucket(),
          Key: key,
          Body: createReadStream(file.path),
          ContentType:
            file.mimetype ||
            (lookup(file.originalname || "") as string) ||
            "application/octet-stream",
          // Drives the filename the browser uses when the signed URL is opened.
          ContentDisposition: `inline; filename="${(file.originalname || "file").replace(/"/g, "")}"`,
        })
      );

      // `id` rather than `key` so the shape matches what the database already
      // stores for Drive uploads, and existing JSON columns stay readable.
      uploaded.push({ id: key, name: file.originalname || file.filename });

      await fs.unlink(file.path).catch(() => undefined);
    }

    return uploaded;
  }

  async getSignedUrl(key: string, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucket(), Key: key }),
      { expiresIn: ttlSeconds }
    );
  }

  async exists(key: string) {
    try {
      await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.bucket(), Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }

  // Returns a stream so callers can pipe straight to a response or an archive
  // without staging the file on local disk, which is what the Drive path did.
  async getStream(key: string): Promise<Readable> {
    const result = await this.getClient().send(
      new GetObjectCommand({ Bucket: this.bucket(), Key: key })
    );
    return result.Body as Readable;
  }

  async deleteFiles(keys: string[]) {
    const present = keys.filter(Boolean);
    if (!present.length) return;

    await this.getClient().send(
      new DeleteObjectsCommand({
        Bucket: this.bucket(),
        Delete: { Objects: present.map((Key) => ({ Key })) },
      })
    );
  }

  // Used by the migration, which already holds bytes in memory.
  async putBuffer(key: string, body: Buffer, contentType?: string) {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        Body: body,
        ContentType: contentType || "application/octet-stream",
      })
    );
    return key;
  }
}

export default new StorageService();
