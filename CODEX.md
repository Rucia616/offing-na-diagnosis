# CODEX.md

## Project

This repo powers Offing public delivery pages on GitHub Pages.

- Root entry: `https://rucia616.github.io/offing-na-diagnosis/`
- Atlas entry: `https://rucia616.github.io/offing-na-diagnosis/atlas/`
- TideLens entry: `https://rucia616.github.io/offing-na-diagnosis/tidelens/`

## Key Paths

- `index.html` - Offing free diagnosis entry.
- `atlas/index.html` - Atlas report library and project entry.
- `tidelens/index.html` - TideLens report library and project entry.
- `tidelens/reports/` - TideLens client-facing reports.
- `tidelens/research/` - TideLens public research/methodology pages.
- `assets/` - favicons, brand logos, and public report assets.
- `*-offing-na-diagnosis-*.html` - Atlas client reports; preserve filenames once links are shared.

Local archives:

- Atlas: `/Users/linsen/Desktop/远汐Offing/01_Offing_Atlas_远汐航图_北美业务诊断`
- TideLens: `/Users/linsen/Desktop/远汐Offing/02_Offing_TideLens_远汐潮镜`

## Operating Rules

- Check `git status` before editing. Do not revert unrelated work.
- Commit only files relevant to the current request.
- Never commit `.env.local` or secrets.
- Preserve old URLs by overwriting the same deployed file unless Rucia asks for a new link.
- After changing a public page, push to `main` and verify the live URL with a cache-buster.
- When updating an Offing report or entry, keep deployed files, `/Users/linsen/Rucia/reports`, and the Desktop Offing archive in sync when applicable.

## Required QA

Before showing or deploying Offing HTML, apply the relevant skills:

- `rucia-offing-common-roast-preflight`
- `rucia-html-report-qa`
- `rucia-offing-delivery-preflight`
- Product VI: `rucia-offing-atlas-vi` or `rucia-tidelens-vi`

Hard gates:

- Client logo, direct diagnosis, score/verdict, and next decision must be obvious above the fold.
- Mobile must not look like enlarged accessibility mode.
- No awkward Chinese line breaks, clipped cards, hidden scores, or horizontal overflow.
- Entry-page counters must match rendered DOM counts.
- Report-library cards need balanced logo wells, clear title, one-sentence verdict, compact chips, and visible scores.
- Report-library scores should be refined metadata pills/rows, not bulky top-right admin boxes.
- Client-facing copy must be direct: no internal process notes, no `老板先看`, no `强相关`, no lazy `不是 X，而是 Y`.

## Delivery Note

Final replies for deployed work should include the live page link, the relevant project entry link, what changed, what was verified, and the commit hash.
