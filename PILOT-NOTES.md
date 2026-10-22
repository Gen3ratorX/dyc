# DYC Care testing pilot

This is the first functional pilot of the approved design, using synthetic records only. It is not ready for real health records or clinical reliance.

## Implemented

- Server-backed 250-warrior synthetic roster and 20 groups, registration and assignments.
- Staff access checks on the server, individual authorship and audit command records.
- Glucose recording in mmol/L, explicit method, actual time and care day, including HI/LO.
- Individual timelines and daily group monitoring.
- Versioned prescribed regimens and separately recorded actual administrations.
- Staff review requests, decline-triggered reviews, acknowledgement, outcome and handover acceptance.
- CSV export restricted by role and group.
- IndexedDB queue, sync retries, duplicate protection and visible failures.
- Service worker for an offline shell after one online visit.

## Pilot limits to test and close before deployment with real records

- Hosted access starts private to the owner. Staff membership controls do not independently grant access through the hosting platform.
- Browser offline cache is not encrypted or protected by a staff PIN/lease. Shared-device hardening, offline account switching, device revocation, and storage recovery must be completed before real data use.
- Clinical numeric rules, automated escalation timers, external notifications and device/CGM integration are not activated or implemented.
- Current pilot uses a fixed five-slot template. Meal-based due windows, individual schedule prescriptions and attendance-aware expected counts are pending.
- All review requests initially go to the medical lead; a group doctor takes ownership by acknowledgement. Automatic routing by staff shift is pending.
- Reading correction/void workflow, historical assignment snapshots and export audit UI are pending. Numeric glucose history charts and group printing are now available. Source readings remain append-only.
- Medication entry is clinician-authored documentation, not a recommendation or dosage check. Offline administration has unavoidable cross-device visibility limits; stale-regimen entries are retained for reconciliation.
- Governance policies and post-camp workflows remain outside scope per user instruction.
- Capacity targets are design targets until verified by a realistic multi-user load test.

## Staff rehearsal

1. Sign in and choose Load demo camp. Confirm 250 warriors appear across 20 groups.
2. Select a warrior and record a synthetic reading; check its group cell and care timeline.
3. Enter a synthetic HI/LO reading and verify the original representation is preserved.
4. At 03:00 the following day, confirm the record belongs to the previous care date.
5. Visit the pilot online once. Disconnect, save a reading, reload, reconnect and retry sync. Confirm exactly one server record.
6. Request review. Acknowledge, start assessment and resolve with an outcome. Try resolving without an outcome.
7. Add a synthetic regimen as a doctor/medical lead. Record administration separately.
8. Assign a tester to one group and verify other groups cannot be accessed through the API.
9. Export CSV and reconcile with the individual history.
10. Record feedback with role, device, action, expected result and actual result. Do not include real patient details.

## Running locally

Open http://127.0.0.1:3001 on this Mac. This workspace includes the redesigned interface, synthetic named profiles and populated reading history. The local launcher uses an isolated demo session; hosted accounts are not involved. Restart with START-LOCAL.command.
