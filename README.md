# DYC Care — Vercel

This branch targets standard Next.js with Supabase Postgres and password sign-in. See [VERCEL.md](VERCEL.md) for connection steps and required environment variables.

The notes below describe the original Cloudflare/local pilot and are retained for reference; use `npm run dev`, `npm run build` and `npm start` for this Vercel checkout.

---

# DYC Care local workspace

Open http://127.0.0.1:3001 on this Mac. The application uses a synthetic local staff session, with its database saved under this project’s .wrangler/state directory. This address is local to the Mac; it is not a published website.

## Start or restart

Double-click START-LOCAL.command in this folder, or run:

```sh
npm run build
npm run local
```

The launcher runs a local database Worker and a loopback-only application host. It provides a fixed demo account for testing. Production uses separate staff authentication; the local launcher remains synthetic-only. Press Ctrl+C in its terminal to stop it. Keep the terminal running while using the app.

## What to test

- Camp overview: choose a group and care day, filter checks, search warriors and move through pages.
- Reading panel: click a check cell, enter a value or device HI/LO, choose the context and save.
- Warrior record: inspect the numeric glucose chart, reading history, medicines and care timeline.
- Clinical reviews: acknowledge a staff request, start assessment, then record an outcome. Handover transfers only after acceptance.
- Reports: filter a care day/group, export CSV or print a group monitoring sheet.
- Offline capture: open the production local app once online, then simulate a lost connection, record an entry, reload and reconnect. The sync centre shows pending or rejected entries.

250 synthetic profiles and demonstration readings are populated for this local workspace. Records created by testers are preserved. To refresh synthetic fixtures without replacing tester entries, run npm run demo:seed while the app is stopped.

## Development

```sh
npm run dev
```

This serves editable source at http://127.0.0.1:5173. Its loopback sign-in uses the starter’s local mock account. The service worker is disabled in development to avoid stale assets; use port 3001 for a full offline-reload rehearsal. If an old development shell is cached, visit /local-reset.html on port 5173 and choose Refresh local workspace. That reset preserves the database and queued records.

## Verification

```sh
node node_modules/typescript/bin/tsc --noEmit
node tests/domain.test.mjs
node tests/offline-crypto.test.mjs
node tests/service-worker.test.mjs
```

Tests in tests/api.test.mjs exercise the local development API with synthetic records. The application was built and browser-tested at desktop and phone widths, and a reading from the redesigned form was verified in the database exactly once. See TEST-RESULTS.md and PILOT-NOTES.md for the implementation scope.

## Limits

Use synthetic data until the launch checks in PRODUCTION-STATUS.md are complete. Encrypted offline storage, per-account device unlock, expiring sessions and Supabase password sign-in are implemented; end-to-end production identity verification, clinical approvals and load testing remain outstanding. Clinical numerical thresholds and automatic notifications are inactive. This application does not recommend treatment or calculate insulin doses. Governance policies and post-camp follow-up remain outside the agreed scope.

## First-time setup on another machine

Node.js 22.13 or newer is required. Install dependencies with npm ci, build, then initialise the local database using the migration command below before launching. Do not upload the local database or browser caches.

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wakeful_the_professor.sql
npm run demo:seed
npm run local
```

### DYC branding

Original logo and favicon assets are from https://diabetesyouthcare.org/. The official website theme defines primary blue `#009EFF` and cyan `#16FFFF`; its navy `#002654` is used for navigation. Controls use a darker blue for legible white text. Logos retain their original colours and proportions.
