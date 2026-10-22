# DYC design study

Inspo MCP v0.1.16 was installed and queried through its hosted MCP endpoint on 18 October 2026. Saved tool results are in the task's `work/inspo/` directory.

Tools used: `recommend`, `search_screens`, `get_screen`.

The Statsig reference supplied by Inspo informed the neutral surfaces, blue accents, clear numeric hierarchy and modular summaries. Elastic and Arrows were additional references for restrained product UI. These are visual references, not clinical workflow specifications. The archive largely contains marketing websites; oversized heroes, decorative 3D cards and landing-page spacing were not carried into the working care dashboard.

Applied changes:

- Replace the promotional banner with three compact cards showing actual camp totals.
- Keep the selected care day and recording action together near the top.
- Increase reading values and supporting text for easier scanning.
- Make the clinical review queue explicit.
- Keep DYC's original logo, navy, blue and cyan.
- Adapt cards for a phone width and show a cue for horizontally scrolling check columns.
- Preserve the existing inline calendar, 24-hour input and fixed form actions.

References: https://statsig.com · https://elastic.co · https://arrows.to

## Typography and character — 19 October 2026

Bricolage Grotesque is the display face for headings and camp totals; Public Sans is used for records, controls and clinical values. Both variable WOFF2 fonts are self-hosted under `public/fonts/`, with their original OFL licenses. The remote Google Fonts import was removed.

Small curved accents, asymmetric corner details and a “Care, together.” signature bring character without changing the DYC logo or clinical meaning.

Verified: TypeScript and production build passed; font responses were HTTP 200 with `font/woff2`; browser font checks returned loaded; desktop 1280px/1440px and phone 390px layouts had no horizontal page overflow. Phone summary cards had equal 134px heights, and the Save action remained visible.
