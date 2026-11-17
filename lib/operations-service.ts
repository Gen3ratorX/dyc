import { randomUUID } from "node:crypto";
import { RequestError } from "./server-security";
import {
  liveActor,
  registrationFingerprint,
  type DeskActor,
} from "./registration-service";
import type { ServerDatabase, WriteTransaction } from "./postgres";
export function operationPermissions(a: DeskActor) {
  return {
    canDesk:
      a.owner ||
      ["administrator", "coordinator", "checkin", "medical_lead"].includes(
        a.role,
      ),
    canAssign:
      a.owner ||
      ["administrator", "coordinator", "checkin", "medical_lead"].includes(
        a.role,
      ),
    canConfigure: a.owner || a.role === "administrator",
    canMedical: ["medical_lead", "doctor", "nurse"].includes(a.role),
  };
}
export function opsVisible(a: DeskActor, w: { group_name: string }) {
  return (
    a.owner ||
    ["administrator", "coordinator", "checkin", "medical_lead"].includes(
      a.role,
    ) ||
    a.groups.includes(w.group_name)
  );
}
export async function operationSnapshot(db: ServerDatabase, a: DeskActor) {
  if (a.role === "analyst")
    throw new RequestError(
      "403:Arrival-desk access is not included in this role.",
    );
  const permissions = operationPermissions(a);
  return db.write(async (tx) => {
    await liveActor(tx, a);
    const rows = await tx.query(
      "SELECT w.id,w.name,w.age,w.group_name,w.room,w.guardian,w.contact,r.reference,r.details,r.reported_care,r.arrival,r.arrived_at,r.documents,r.medical,r.room_id,r.bed,r.team_id,r.version FROM warriors w JOIN registrations r ON r.warrior_id=w.id ORDER BY w.name",
    );
    const teams = await tx.query("SELECT * FROM camp_teams ORDER BY name");
    const ledTeams = new Set(
      teams.filter((t) => t.leader === a.email).map((t) => t.id),
    );
    const people = rows
      .filter(
        (w) =>
          opsVisible(a, w as any) ||
          (a.role === "mentor" && ledTeams.has(w.team_id)),
      )
      .map((w) => {
        const { reported_care, details, guardian, contact, ...rest } = w;
        const d = { phone: contact, guardian, ...JSON.parse(details) };
        return {
          ...rest,
          details: permissions.canDesk || permissions.canMedical ? d : {},
          ...(permissions.canMedical
            ? { care: JSON.parse(reported_care) }
            : {}),
        };
      });
    const rooms = await tx.query(
      "SELECT * FROM camp_rooms ORDER BY building,name",
    );
    const [open] = await tx.query(
      "SELECT value FROM settings WHERE key='registration_open'",
    );
    return {
      people,
      rooms,
      teams,
      ...permissions,
      open: open?.value !== "false",
      offlineExpiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
      actor: a.user.userId,
      scope: JSON.stringify([a.role, a.groups, a.owner]),
    };
  });
}
const fail = (s: string): never => {
  throw new RequestError(s);
};
const text = (v: unknown, label: string, max = 150, required = true) => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    return fail("400:Enter a valid " + label + ".");
  return v.trim();
};
export async function operationWrite(
  db: ServerDatabase,
  a: DeskActor,
  input: Record<string, any>,
) {
  const permissions = operationPermissions(a),
    { action } = input;
  return db.write(async (tx) => {
    await liveActor(tx, a);
    const now = new Date().toISOString();
    const audit = async (warrior: string | null, details: unknown) => {
      await tx.query(
        "INSERT INTO arrival_events(id,warrior_id,actor,action,at,details) VALUES (?,?,?,?,?,?)",
        [randomUUID(), warrior, a.email, action, now, JSON.stringify(details)],
      );
    };
    if (action === "export-roster") {
      if (!permissions.canDesk) fail("403:Arrival-desk access is required.");
      await audit(null, {
        requestedRows: Number.isSafeInteger(input.count) ? input.count : 0,
      });
      return;
    }
    if (action === "registration-open") {
      if (!permissions.canConfigure)
        fail("403:Only a camp administrator can open or close registration.");
      if (typeof input.open !== "boolean") fail("400:Choose open or closed.");
      await tx.query(
        "INSERT INTO settings(key,value) VALUES ('registration_open',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [String(input.open)],
      );
      await audit(null, { open: input.open });
      return;
    }
    if (action === "room" || action === "team") {
      if (!permissions.canConfigure)
        fail("403:Only a camp administrator can change rooms and teams.");
      const id = input.id ? text(input.id, "ID", 100) : randomUUID(),
        name = text(input.name, "name", 80),
        active = input.active === false ? 0 : 1;
      const table = action === "room" ? "camp_rooms" : "camp_teams";
      const [prior] = await tx.query("SELECT * FROM " + table + " WHERE id=?", [
        id,
      ]);
      if (prior && prior.version !== input.version)
        fail("409:This has changed. Refresh before saving again.");
      if (action === "room") {
        const building = text(input.building, "building", 80),
          capacity = input.capacity;
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)
          fail("400:A room must have between 1 and 100 beds.");
        const [used] = await tx.query(
          "SELECT count(*) AS total,max(bed) AS highest FROM registrations WHERE room_id=?",
          [id],
        );
        if (
          (!active && Number(used.total) > 0) ||
          Number(used.highest) > capacity
        )
          fail(
            "409:Move the assigned participants before reducing or retiring this room.",
          );
        if (
          (
            await tx.query(
              "SELECT id FROM camp_rooms WHERE building=? AND name=? AND id<>?",
              [building, name, id],
            )
          ).length
        )
          fail("409:This building already has a room with that name.");
        if (prior)
          await tx.query(
            "UPDATE camp_rooms SET building=?,name=?,capacity=?,active=?,version=version+1 WHERE id=?",
            [building, name, capacity, active, id],
          );
        else
          await tx.query(
            "INSERT INTO camp_rooms(id,building,name,capacity,active) VALUES (?,?,?,?,?)",
            [id, building, name, capacity, active],
          );
        if (prior)
          await tx.query(
            "UPDATE warriors SET room=?,version=version+1 WHERE id IN (SELECT warrior_id FROM registrations WHERE room_id=?)",
            [building + " · " + name, id],
          );
      } else {
        const leader = text(
          input.leader || "",
          "team leader staff email",
          150,
          false,
        ).toLowerCase();
        if (
          leader &&
          !(
            await tx.query(
              "SELECT email FROM members WHERE email=? AND active=1 AND role IN ('mentor','coordinator','medical_lead','doctor','nurse')",
              [leader],
            )
          ).length
        )
          fail(
            "400:Choose the email of an active mentor or care-team staff account.",
          );
        if (
          (
            await tx.query("SELECT id FROM camp_teams WHERE name=? AND id<>?", [
              name,
              id,
            ])
          ).length
        )
          fail("409:An activity team already has that name.");
        if (
          !active &&
          (
            await tx.query(
              "SELECT warrior_id FROM registrations WHERE team_id=?",
              [id],
            )
          ).length
        )
          fail("409:Reassign participants before retiring this team.");
        if (prior)
          await tx.query(
            "UPDATE camp_teams SET name=?,leader=?,active=?,version=version+1 WHERE id=?",
            [name, leader, active, id],
          );
        else
          await tx.query(
            "INSERT INTO camp_teams(id,name,leader,active) VALUES (?,?,?,?)",
            [id, name, leader, active],
          );
      }
      await audit(null, { id, name, active });
      return;
    }
    const id = text(input.warrior, "participant ID", 100);
    const [r] = await tx.query(
      "SELECT r.*,w.group_name FROM registrations r JOIN warriors w ON w.id=r.warrior_id WHERE r.warrior_id=?",
      [id],
    );
    if (!r || !opsVisible(a, r as any))
      fail("404:Participant unavailable to this account.");
    if (action === "arrival") {
      if (!permissions.canDesk) fail("403:Arrival-desk access is required.");
      if (
        typeof input.commandId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(input.commandId)
      )
        fail("400:Invalid arrival reference.");
      const serialized = JSON.stringify({ warrior: id, at: input.at });
      const [previous] = await tx.query(
        "SELECT actor,body FROM commands WHERE id=?",
        [input.commandId],
      );
      if (previous) {
        if (previous.actor !== a.user.userId || previous.body !== serialized)
          fail("409:This arrival reference was already used.");
        return;
      }
      // A second desk or delayed offline retry must not duplicate an arrival.
      // A reversed arrival stays protected by the version check below.
      if (r.arrival === "Arrived") {
        await tx.query(
          "INSERT INTO commands(id,actor,body,at) VALUES (?,?,?,?)",
          [input.commandId, a.user.userId, serialized, now],
        );
        await audit(id, { alreadyRecorded: true, originalAt: r.arrived_at });
        return;
      }
      if (r.version !== input.version)
        fail(
          "409:This participant’s arrival record changed. Refresh and confirm their status before saving.",
        );
      const at = text(input.at, "arrival time", 40);
      if (
        !Number.isFinite(Date.parse(at)) ||
        Date.parse(at) > Date.now() + 300000 ||
        Date.parse(at) < Date.now() - 14 * 24 * 3600000
      )
        fail("400:Arrival time must be within the last 14 days.");
      await tx.query(
        "UPDATE registrations SET arrival='Arrived',arrived_at=?,arrived_by=?,version=version+1 WHERE warrior_id=?",
        [at, a.email, id],
      );
      await tx.query(
        "INSERT INTO commands(id,actor,body,at) VALUES (?,?,?,?)",
        [input.commandId, a.user.userId, serialized, now],
      );
      await audit(id, { at });
      return;
    }
    if (r.version !== input.version)
      fail(
        "409:This participant’s details changed. Refresh and check before saving again.",
      );
    if (action === "contacts") {
      if (!permissions.canDesk) fail("403:Arrival-desk access is required.");
      const reason = text(input.reason, "correction reason", 1000);
      const d = JSON.parse(r.details);
      for (const key of [
        "phone",
        "guardian",
        "emergencyName",
        "emergencyPhone",
        "emergencyPhone2",
        "diet",
      ]) {
        d[key] = text(
          input[key] || "",
          key,
          key === "diet" ? 2000 : 150,
          key !== "guardian",
        );
      }
      for (const key of ["phone", "emergencyPhone", "emergencyPhone2"])
        if (!/^\+?[\d\s()-]{9,24}$/.test(d[key]))
          fail("400:Enter valid contact phone numbers.");
      const name = text(input.name, "participant name", 150);
      d.name = name;
      const fingerprint = d.dob
        ? registrationFingerprint({ name, dob: d.dob, phone: d.phone })
        : null;
      if (
        fingerprint &&
        (
          await tx.query(
            "SELECT warrior_id FROM registrations WHERE fingerprint=? AND warrior_id<>?",
            [fingerprint, id],
          )
        ).length
      )
        fail(
          "409:These details match another registration. Ask the coordinator to review both records.",
        );
      await tx.query(
        "UPDATE registrations SET details=?,fingerprint=?,version=version+1 WHERE warrior_id=?",
        [JSON.stringify(d), fingerprint, id],
      );
      await tx.query(
        "UPDATE warriors SET name=?,contact=?,guardian=?,version=version+1 WHERE id=?",
        [name, d.phone, d.guardian, id],
      );
      await audit(id, {
        reason,
        fields: [
          "name",
          "phone",
          "guardian",
          "emergencyName",
          "emergencyPhone",
          "emergencyPhone2",
          "diet",
        ],
      });
      return;
    }
    if (action === "reverse-arrival") {
      if (!permissions.canDesk) fail("403:Arrival-desk access is required.");
      const reason = text(input.reason, "correction reason", 1000);
      if (r.arrival !== "Arrived")
        fail("409:This participant is not marked as arrived.");
      await tx.query(
        "UPDATE registrations SET arrival='Expected',arrived_at='',arrived_by='',version=version+1 WHERE warrior_id=?",
        [id],
      );
      await audit(id, { reason, previousAt: r.arrived_at });
      return;
    }
    if (action === "documents") {
      if (!permissions.canDesk) fail("403:Arrival-desk access is required.");
      if (typeof input.verified !== "boolean")
        fail("400:Choose a document status.");
      await tx.query(
        "UPDATE registrations SET documents=?,version=version+1 WHERE warrior_id=?",
        [input.verified ? 1 : 0, id],
      );
      await audit(id, { verified: input.verified });
      return;
    }
    if (action === "medical") {
      if (!permissions.canMedical)
        fail(
          "403:Only assigned clinical staff can record an arrival assessment.",
        );
      if (!["Pending", "Reviewed"].includes(input.status))
        fail("400:Choose an assessment status.");
      await tx.query(
        "UPDATE registrations SET medical=?,medical_by=?,medical_at=?,version=version+1 WHERE warrior_id=?",
        [input.status, a.email, now, id],
      );
      await audit(id, { status: input.status });
      return;
    }
    if (action === "assignment") {
      if (!permissions.canAssign) fail("403:Rooming-desk access is required.");
      const roomId = input.roomId || null,
        teamId = input.teamId || null,
        bed = roomId ? input.bed : null;
      let room = "";
      if (roomId) {
        const [roomRow] = await tx.query(
          "SELECT * FROM camp_rooms WHERE id=? AND active=1",
          [roomId],
        );
        if (
          !roomRow ||
          !Number.isInteger(bed) ||
          bed < 1 ||
          bed > roomRow.capacity
        )
          fail("400:Choose an available room and bed.");
        if (
          (
            await tx.query(
              "SELECT warrior_id FROM registrations WHERE room_id=? AND bed=? AND warrior_id<>?",
              [roomId, bed, id],
            )
          ).length
        )
          fail("409:That bed was just assigned. Choose another bed.");
        room = roomRow.building + " · " + roomRow.name;
      }
      if (
        teamId &&
        !(
          await tx.query("SELECT id FROM camp_teams WHERE id=? AND active=1", [
            teamId,
          ])
        ).length
      )
        fail("400:Choose an active activity team.");
      const clinicalGroup = input.group || r.group_name;
      if (
        clinicalGroup !== r.group_name &&
        !a.owner &&
        !["coordinator", "medical_lead"].includes(a.role)
      )
        fail(
          "403:Only the coordinator or medical lead can change clinical groups.",
        );
      if (
        clinicalGroup !== "Unassigned" &&
        !/^Group [A-T]$/.test(clinicalGroup)
      )
        fail("400:Choose a clinical group.");
      await tx.query(
        "UPDATE registrations SET room_id=?,bed=?,team_id=?,version=version+1 WHERE warrior_id=?",
        [roomId, bed, teamId, id],
      );
      await tx.query(
        "UPDATE warriors SET room=?,group_name=?,version=version+1 WHERE id=?",
        [room, clinicalGroup, id],
      );
      await audit(id, {
        before: {
          room: r.room_id,
          bed: r.bed,
          team: r.team_id,
          group: r.group_name,
        },
        after: { room: roomId, bed, team: teamId, group: clinicalGroup },
      });
      return;
    }
    fail("400:Unknown arrival-desk action.");
  });
}
