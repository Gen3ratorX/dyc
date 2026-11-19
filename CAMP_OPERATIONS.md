# Camp Victory registration and arrivals

Start here: https://dyc-snowy.vercel.app/

Choose **Register for camp** for participants or **Staff sign in** for the staff workspace. Staff are directed to their role’s dashboard after sign-in. Check-in, rooms, teams and care tools are available through the workspace navigation.

Staff sign-in: https://dyc-snowy.vercel.app/login

Public registration: https://dyc-snowy.vercel.app/register
Staff workspace: https://dyc-snowy.vercel.app/check-in
Rooms and activity teams: https://dyc-snowy.vercel.app/rooms-teams

## Before sharing registration

1. Review the event details and permission wording with DYC. Camp dates are 19–22 November 2026 at Pentecost Convention Center, Kasoa.
2. Set the participant limit in Camp settings. Existing warrior records count toward the limit.
3. In Rooms & teams, add the real accommodation blocks, room names and bed counts. Create activity teams separately. Use an active staff email for the team leader; mentor leaders can see their team roster without gaining extra clinical-history access.
4. Create individual staff accounts. Every approved staff role can search all registrations and record arrival, including campers without a clinical group. The Checkin role is for dedicated arrival-desk staff; the coordinator or medical lead assigns clinical care groups. Administrators can manage arrivals, rooms, teams, capacity and staff accounts without seeing clinical history.
5. Run a rehearsal on the actual phones/tablets and test searching, arrival confirmation and the printer. Keep a connected rooming desk available.

## Registration

The public four-step form does not require an account. There is no registration age limit. Age is calculated on 19 November 2026 from a valid date of birth on or before that date. Under-18 registrations require guardian permission and a signed guardian form at arrival. Photo/video permission can be refused without blocking registration. Applicants receive a readable registration reference. There is no public reference lookup that reveals participant information.

Answers stay in page memory between steps; drafts are not saved in browser storage. Registration and walk-in registration need a connection. The confirmation can be printed, including a guardian signature page for minors. Reported insulin and dosing are information for review, never an approved prescription.

Administrators can close/reopen the public form from Check-in. Closing it does not disable staff walk-in registration. Existing records are included in the arrival roster with unknown permissions/documents left outstanding; no consent is invented for existing records.

## Arrival desk

1. Search by name, phone or registration reference. No phone is required to find a participant.
2. Confirm identity and contact details. Use the correction form with a reason if necessary.
3. Mark the participant as arrived. This does not certify that documents or medical review are complete.
4. Check participation documents and, for a minor, the signed guardian permission form. Mark documents as checked only after verification.
5. Allocate a room, an available bed and an activity team. A coordinator or medical lead also assigns the clinical care group so the right clinicians can access the care record.
6. Clinical staff assigned to the camper review the reported care information and mark the arrival assessment complete. Prescriptions and actual care remain in the existing clinical record.

Two participants cannot have the same managed bed. The server serializes registration, capacity and rooming writes, checks the current record version and checks bed availability again when saving. Rooms/teams with assigned participants cannot be retired. A room cannot be reduced below an assigned bed number. Retiring an unused resource preserves history.

A mistaken arrival can be reversed with a reason. This preserves room/team assignments and the audit history. Repeat arrival requests do not overwrite the original arrival time. Staff changes and desk actions are audited in the private database.

Operational CSV exports and printable rosters omit clinical history. Name badges include name, team, room and registration reference. Treat printed rosters and downloaded CSVs as staff material.

## Offline arrival capture

Enable protected offline access in My account, then open Check-in while online to load the permitted roster. It is stored encrypted under that staff account. Sign out before sharing a device.

While offline, staff can find participants in the saved roster and queue arrival records. Pending sync is explicitly shown; other devices do not see the arrival until it syncs. An offline session expires eight hours after its last verified refresh. Reconnect and sign in to sync pending records. Delayed arrival submissions can sync for up to 14 days; the server retains the original captured time and separately records receipt time.

Registration, edits, documents, clinical assessments and room/bed/team allocation require a connection. Use the designated connected rooming desk during an outage. An already-recorded arrival is treated as a harmless duplicate; an arrival reversed or otherwise changed before sync requires staff reconciliation instead of overwriting that change.

## Verification

`npm test` includes the existing clinical/staff/crypto/SQL tests and isolated registration/operations integration tests. The new tests cover eligibility, optional photo refusal, submission retry and duplicate prevention, capacity, role isolation, scope checks, last-bed races, document/assessment workflow, corrections, closure and suspended staff.

The migration enables RLS on all new private tables and denies direct anon/authenticated access. Production SQL privileges were exercised in a rolled-back synthetic transaction. Browser checks use fictional local fixtures; they do not insert test participants in production. Physical printing still needs rehearsal on the camp’s actual devices.

Known hosting advisory: Supabase currently reports [leaked-password checking disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This predates the arrival system. New staff passwords still use the existing minimum-length checks and individual authenticated accounts.
