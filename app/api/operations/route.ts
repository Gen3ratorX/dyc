import { context } from "../../../lib/camp-context";
import {
  requireSameOrigin,
  secureHeaders,
  rateLimit,
  failure,
  RequestError,
} from "../../../lib/server-security";
import {
  operationSnapshot,
  operationWrite,
} from "../../../lib/operations-service";
import { registerParticipant } from "../../../lib/registration-service";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const a = await context();
    await rateLimit(a.db, a.user.userId, "arrivals-read", 120);
    return Response.json(await operationSnapshot(a.db, a), {
      headers: secureHeaders,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const a = await context();
    await rateLimit(a.db, a.user.userId, "arrivals-write", 90);
    const text = await req.text();
    if (text.length > 24000) throw new RequestError("413:Entry too large.");
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new RequestError("400:Invalid request.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new RequestError("400:Invalid request.");
    if (body.action === "walkin")
      return Response.json(
        await registerParticipant(a.db, body.details, body.requestId, a),
        { headers: secureHeaders },
      );
    await operationWrite(a.db, a, body);
    return Response.json({ ok: true }, { headers: secureHeaders });
  } catch (e) {
    return failure(e);
  }
}
