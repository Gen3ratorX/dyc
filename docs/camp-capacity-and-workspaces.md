# Participant capacity and staff workspaces

The camp owner and administrators can open **Camp settings → Change participant limit**. The initial limit is 300; changes are saved in the private `dyc.settings` table and reflected on every refreshed staff device. Accepted limits are whole numbers from 1 to 10,000, never below the current registered count. The setting is a registration limit, not a claim of tested infrastructure capacity.

Registration enforces the shared limit inside the write transaction. Stale capacity edits and simultaneous registrations cannot overwrite the latest setting or exceed the limit. Existing registrations are not removed when capacity changes. Group assignments remain the existing twenty groups.

Non-admin workspaces use shorter navigation and remove repeated camp-level panels:

- Doctors and nurses start with their care group, readings and review count.
- Mentors start with their assigned warriors and review requests; export navigation is omitted.
- Coordinators start in the camp roster with registration and assignment actions.
- Analysts start with de-identified CSV reports.
- Non-owner medical leads retain camp-wide clinical access in a simpler care overview.
- Every staff role has **My account** for password changes, offline access, saved-entry sync status and sign-out.
- Administrators start in camp settings; the camp owner retains the full camp workspace.

Server permissions remain authoritative. Simpler navigation does not widen access to clinical data.

Verification: synthetic real-handler CRUD tests cover administrator/owner authorization, invalid capacity, minimum registered count, stale capacity edits, concurrent capacity changes, and competition for the last registration place. Role policy tests cover every home/navigation variant. Desktop and 390px mobile browser checks used synthetic fixtures, including a test increase from 300 to 500. No production capacity, staff or participant records were changed by those checks.
