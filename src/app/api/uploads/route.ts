import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ cloud: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.BLOB_READ_WRITE_TOKEN && request.headers.get("content-type")?.includes("application/json")) {
    const result = await handleUpload({
      request,
      body: await request.json() as HandleUploadBody,
      onBeforeGenerateToken: async () => ({ addRandomSuffix: true, maximumSizeInBytes: 250 * 1024 * 1024 }),
    });
    return Response.json(result);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > 250 * 1024 * 1024) return Response.json({ error: "That file is too large to send." }, { status: 400 });

  const extension = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 10);
  const storedName = `${randomUUID()}${extension}`;
  const uploadDirectory = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, storedName), Buffer.from(await file.arrayBuffer()));

  return Response.json({
    url: `/uploads/${storedName}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  });
}
