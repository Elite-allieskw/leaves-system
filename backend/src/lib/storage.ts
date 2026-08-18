import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * Object storage for visit photos/videos.
 *
 * Works with AWS S3 or Cloudflare R2 (R2 speaks the S3 API — just set
 * S3_ENDPOINT to the R2 account endpoint and it works identically).
 *
 * If S3_BUCKET isn't set, falls back to writing to local disk under /uploads
 * so the app still runs for local development without cloud credentials —
 * but this fallback is NOT durable storage (files are lost on redeploy in
 * most hosting environments) and must not be relied on past Sprint 1 dev/testing.
 */

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION || "auto";
const endpoint = process.env.S3_ENDPOINT; // required for R2, omit for AWS S3
const publicUrlBase = process.env.S3_PUBLIC_URL_BASE; // e.g. a CDN domain or the bucket's public URL

const s3Client = bucket
  ? new S3Client({
      region,
      endpoint,
      forcePathStyle: !!endpoint, // R2 and most S3-compatible providers need path-style addressing
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
    })
  : null;

export const storageMode: "s3" | "local-fallback" = s3Client ? "s3" : "local-fallback";

export type StoredFile = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
};

/**
 * Uploads a file under a logical folder (e.g. "visits/<clientId>") and
 * returns a URL the frontend can use to display/download it.
 */
export async function uploadFile(folder: string, file: StoredFile): Promise<string> {
  const ext = path.extname(file.originalName) || "";
  const key = `${folder}/${randomUUID()}${ext}`;

  if (s3Client && bucket) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
      })
    );
    if (publicUrlBase) return `${publicUrlBase.replace(/\/$/, "")}/${key}`;
    // Fallback URL shape if no CDN/public base configured — works for buckets
    // with public-read access; private buckets should set S3_PUBLIC_URL_BASE
    // to a signed-URL-serving endpoint instead.
    return endpoint
      ? `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  // Local-disk fallback for dev environments without a bucket configured yet.
  const localDir = path.join("uploads", folder);
  await fs.mkdir(localDir, { recursive: true });
  const localPath = path.join(localDir, `${randomUUID()}${ext}`);
  await fs.writeFile(localPath, file.buffer);
  return `/${localPath.replace(/\\/g, "/")}`;
}
