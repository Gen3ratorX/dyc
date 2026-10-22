# Pilot verification

Verified locally on 18 October 2026 using synthetic data only.

- TypeScript checking passed.
- Production build passed.
- Eight-table database migration applied successfully to the local test database.
- Domain checks passed for care-day boundaries, role permissions, mmol/L validation, HI/LO, invalid values, overrides, administration requirements and CSV formula escaping.
- API checks passed for authentication, the 250-warrior seed, persistent readings, duplicate submissions, author mismatches, review transitions, outcome requirements, stale versions and separate regimen/administration records.
- Server permission checks passed for group isolation, mentor prescribing restrictions, nurse exception limits, coordinator access restrictions, analyst field filtering, administrator isolation and unlisted-account denial.
- Browser rehearsal saved a reading through the phone-sized interface and verified it in the group sheet.
- Production-asset connection-loss rehearsal saved a reading, reloaded from the cached shell, retained the pending record, restored connection and synced successfully. A server query confirmed one stored record for that rehearsal.
- Desktop and phone-sized layouts were visually inspected. A screenshot is supplied separately.

The connection-loss rehearsal used a loopback-only test proxy with a synthetic local identity. It did not disable the user's network or alter system settings. This does not replace testing on the staff's actual phones, tablets and camp network.

Not yet verified: hosted deployment, hosted database migration, staff sharing, a 60-user load test, real-device storage recovery, shared-device offline controls or clinical production readiness. See PILOT-NOTES.md for scope limitations.

## Local interface redesign

The redesigned workspace was checked at 1440 px and 390 px widths. The new reading drawer saved a synthetic value of 7.3 mmol/L and a server query confirmed exactly one record. Mobile navigation opened the registry and selected a warrior; the profile rendered its glucose chart with no page overflow. Phone forms stack date and time controls. TypeScript checks, domain checks and the production build passed.

The persistent local workspace runs at http://127.0.0.1:3000 with a loopback-only demo identity and the existing local database. Cross-origin write attempts were rejected. It is intentionally left running for the user to test. No source or records were uploaded.

The final revised preview is served separately at http://127.0.0.1:3001 so the original test session on port 3000 is not interrupted.

## Inspo design pass — 18 October 2026

- Inspo hosted MCP queried using `recommend`, `search_screens`, and `get_screen`; Statsig reference inspected visually.
- TypeScript check and production build passed.
- Camp API retained 251 warriors; all nine initial stylesheet/JavaScript references returned HTTP 200 before final spacing adjustments.
- Desktop and 390px phone layouts inspected; phone page width was 390px with no horizontal page overflow.
- Reading form Save remained within the phone viewport (bottom 759px at an 844px viewport height).
- Changes are presentation and navigation clarity; clinical calculation and capture logic unchanged.
