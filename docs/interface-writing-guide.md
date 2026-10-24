# DYC Care interface writing

Reviewed 24 October 2026 across sign-in, offline setup/unlock, role home screens, warrior lists and profiles, glucose entry, care notes, missed/waived checks, prescriptions, doses given, clinical reviews and handovers, exports, sync, account settings and camp administration.

## Voice and terms

Use calm, direct language that helps a busy staff member choose the next action. Keep DYC’s term **warrior**. Use **Record glucose**, **Care note**, **Prescription**, **Dose given**, **Clinical review**, **My account** and **Sign out** consistently. Button labels should describe the result, such as **Save prescription** or **Request handover**.

Use **care day** for the 06:00–05:59 reporting period; avoid “today” when the user can select a historical date. Use **saved on this device** for unsynced entries and **synced to the camp record** only after acceptance by the server. **Up to date** describes sync status, not whether an unfinished form has been saved.

Do not describe a prescription as verified unless the product has a corresponding verification step. Do not imply a dose was given merely because it was prescribed. Review instructions should explain who remains responsible during a handover. Keep the existing notice that automatic alerts are not enabled.

## Guidance and feedback

- Empty states explain what is missing and the next available action for that role.
- Errors explain what changed and how to recover, without exposing database details.
- Optional registration fields are labelled; required fields retain validation.
- Timing questions distinguish glucose measurements, doses given and other care events.
- An unavailable export explains how readings become available.
- Use singular or plural labels that match the count.
- Remove slogans and headings that repeat the title immediately below them.

Stored clinical statuses, measurement methods, units, permissions and workflow rules are unchanged. Validation and CRUD regression tests accompany the release; desktop and mobile visual reviews use synthetic records only.
