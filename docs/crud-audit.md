# CRUD audit — 24 October 2026

Reviewed the production routes for staff provisioning and permissions, password changes, warrior registration and assignment, readings and observations, prescriptions and administrations, review transitions and handovers, camp reads and exports.

## Fixed

- Staff permission updates now compare the permissions shown to the administrator with the current record and recheck that comparison in the write transaction. A stale edit, suspension or restore cannot overwrite a newer permission change.
- Prescription and assignment forms retain the versions opened by the user. Background polling cannot silently turn an old draft into an apparently current update. Administration forms retain the prescription actually presented to the user.
- Group-scoped clinical writes recheck the warrior's group in the transaction, preventing a write authorized immediately before reassignment from crossing the updated group boundary.
- Handovers require a linked, active doctor or medical lead. Recipient permissions and the applicable warrior group are checked again in the transaction. Resolved reviews cannot be handed over or accept a pending handover. Resolution, reopening and acknowledgement clear obsolete handover proposals.
- Doctor, nurse and mentor access updates require an assigned group on the server, matching account creation and the UI.
- Invalid UTC clock times that normalize into a different date are rejected.
- Credential fields are rejected from care commands before audit/command persistence. Passwords continue to use their dedicated account and password endpoints.

## Verification

`npm test` includes `tests/crud.test.mjs`, which runs the actual command, camp-read and export handlers against an isolated in-memory relational database with synthetic data. The identity and transport adapters are replaced; application validation, authorization decisions, transaction guards, SQL statements, filtering and response generation run normally.

Coverage includes registration, persisted readings and notes, identical retries, changed-content ID reuse, prescription versions, stale administration references, review lifecycle, handover acceptance, suspension/reassignment races, optimistic staff updates, session revocation, role restrictions, analyst redaction and audited CSV export. UI source checks guard the captured-version bindings.

The generated write statements were also planned successfully with PostgreSQL `EXPLAIN` under the production `dyc_app` role. These probes did not execute writes. TypeScript and the optimized production build passed.

Clinical records remain append-only and prescriptions retain version history; staff access uses suspension/restoration. No hard-delete endpoint was introduced. No real participant, staff account or password was changed by the tests. Live administrator-created account creation and password changes are not exercised by this synthetic handler harness.
