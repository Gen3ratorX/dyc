import { createHash } from "node:crypto";
import {
  runtime,
  RequestError,
  requireSameOrigin,
  secureHeaders,
  rateLimit,
  failure,
} from "../../../lib/server-security";
import { registerParticipant } from "../../../lib/registration-service";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = runtime().DB;
    if (!db)
      throw new RequestError(
        "503:Registration is temporarily unavailable. Please contact the camp team.",
      );
    const row = await db
      .prepare("SELECT value FROM settings WHERE key='registration_open'")
      .first<{ value: string }>();
    return Response.json(
      { open: row?.value !== "false" },
      { headers: secureHeaders },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const db = runtime().DB;
    if (!db)
      throw new RequestError(
        "503:Registration is temporarily unavailable. Please contact the camp team.",
      );
    const text = await req.text();
    if (text.length > 24000)
      throw new RequestError(
        "413:Registration is too large. Shorten the notes and try again.",
      );
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new RequestError("400:Check the registration form and try again.");
    }
    if (body.website) throw new RequestError("400:Unable to submit this form.");
    const ip =
      req.headers.get("x-vercel-forwarded-for") ||
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      "local";
    await rateLimit(
      db,
      createHash("sha256").update(ip).digest("hex"),
      "registration",
      20,
    );
    return Response.json(
      await registerParticipant(db, body.details, body.requestId),
      { status: 201, headers: secureHeaders },
    );
  } catch (e) {
    return failure(e);
  }
}
