import { createHash, randomUUID } from "node:crypto";
import { campCapacity } from "./domain";
import { campAge, registrationInput, registrationParts } from "./registration";
import { RequestError } from "./server-security";
import type { ServerDatabase, WriteTransaction } from "./postgres";
export type DeskActor = {
  user: { userId: string };
  email: string;
  role: string;
  groups: string[];
  owner: boolean;
};
export async function liveActor(tx: WriteTransaction, a: DeskActor) {
  if (a.owner) {
    const [owner] = await tx.query(
      "SELECT value FROM settings WHERE key='owner'",
    );
    if (owner?.value !== a.user.userId)
      throw new RequestError("403:Camp ownership changed. Sign in again.");
  }
  const [m] = await tx.query(
    "SELECT role,groups_json,active,user_id FROM members WHERE email=?",
    [a.email],
  );
  if (
    !m ||
    m.active !== 1 ||
    m.user_id !== a.user.userId ||
    m.role !== a.role ||
    m.groups_json !== JSON.stringify(a.groups)
  )
    throw new RequestError("403:Your access changed. Refresh and try again.");
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const registrationFingerprint = (p: {
  name: string;
  dob: string;
  phone: string;
}) =>
  hash(
    p.name.toLowerCase().trim().replace(/\s+/g, " ") +
      "|" +
      p.dob +
      "|" +
      p.phone.replace(/\D/g, ""),
  );
export async function registerParticipant(
  db: ServerDatabase,
  raw: unknown,
  requestId: string,
  actor?: DeskActor,
) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId))
    throw new RequestError("400:Refresh the registration form and try again.");
  const p = registrationInput(raw),
    parts = registrationParts(p),
    bodyHash = hash(JSON.stringify(p));
  return db.write(async (tx) => {
    if (actor) {
      await liveActor(tx, actor);
      if (
        !actor.owner &&
        !["coordinator", "checkin", "medical_lead", "administrator"].includes(
          actor.role,
        )
      )
        throw new RequestError("403:Arrival-desk access is required.");
    }
    const [prior] = await tx.query(
      "SELECT reference,request_hash FROM registrations WHERE request_id=?",
      [requestId],
    );
    if (prior) {
      if (prior.request_hash !== bodyHash)
        throw new RequestError(
          "409:This submission has already been used. Open a new registration.",
        );
      return { reference: prior.reference };
    }
    const [state] = await tx.query(
      "SELECT value FROM settings WHERE key='registration_open'",
    );
    if (!actor && state?.value === "false")
      throw new RequestError(
        "409:Registration is closed. Please contact the camp team.",
      );
    const fingerprint = registrationFingerprint(p);
    if (
      (
        await tx.query(
          "SELECT warrior_id FROM registrations WHERE fingerprint=?",
          [fingerprint],
        )
      ).length
    )
      throw new RequestError(
        "409:A matching registration is already on file. Contact the camp team if you need your reference or a correction.",
      );
    const [setting] = await tx.query(
        "SELECT value FROM settings WHERE key='camp_capacity'",
      ),
      [count] = await tx.query("SELECT count(*) AS total FROM warriors");
    if (Number(count.total) >= campCapacity(setting?.value))
      throw new RequestError(
        "409:The camp has reached its participant limit. Contact the camp team for assistance.",
      );
    const id = "DYC-" + randomUUID(),
      reference = "DYC26-" + randomUUID().replaceAll("-", "").toUpperCase(),
      now = new Date().toISOString();
    await tx.query(
      "INSERT INTO warriors(id,name,age,group_name,room,guardian,contact,allergies,version) VALUES (?,?,?,?,?,?,?,?,1)",
      [
        id,
        p.name,
        campAge(p.dob),
        "Unassigned",
        "",
        p.guardian,
        p.phone,
        p.support,
      ],
    );
    await tx.query(
      "INSERT INTO registrations(warrior_id,reference,fingerprint,request_id,request_hash,details,reported_care,source,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        reference,
        fingerprint,
        requestId,
        bodyHash,
        JSON.stringify(parts.details),
        JSON.stringify(parts.care),
        actor ? "walkin" : "public",
        now,
        actor?.email || "participant",
      ],
    );
    await tx.query(
      "INSERT INTO arrival_events(id,warrior_id,actor,action,at,details) VALUES (?,?,?,?,?,?)",
      [
        randomUUID(),
        id,
        actor?.email || "participant",
        "Registered",
        now,
        JSON.stringify({
          source: actor ? "walkin" : "public",
          consentVersion: "2026-11-17",
        }),
      ],
    );
    return { reference };
  });
}
