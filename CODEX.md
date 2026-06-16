# CODEX.md

## Project

This repo powers Offing public delivery pages:

- Atlas North America business diagnosis reports and project entry.
- TideLens public pages when present.
- Static GitHub Pages files plus a small API prototype.

Live base URL:

```text
https://rucia616.github.io/offing-na-diagnosis/
```

## Important Paths

- `index.html` - free diagnosis entry page.
- `atlas/index.html` - Atlas project entry and report library.
- `atlas/research/` - public research-library area.
- `assets/` - favicon, logos, and public report assets.
- `*-offing-na-diagnosis-*.html` - client-facing Atlas report files. Preserve existing filenames if links were already sent.
- Local archive: `/Users/linsen/Desktop/远汐Offing/01_Offing_Atlas_远汐航图_北美业务诊断`

## Deployment Rules

- GitHub Pages deploys from `main`.
- Preserve old URLs by overwriting the same deployed filename unless Rucia asks for a new link.
- Commit only files relevant to the current task. Do not include unrelated dirty files.
- Never commit `.env.local` or secrets.
- After changing a public page, verify the live URL with a cache-buster.

## Offing QA Rules

Before sending or deploying any Offing HTML, apply:

- `rucia-offing-common-roast-preflight`
- `rucia-html-report-qa`
- `rucia-offing-delivery-preflight`
- Product VI skill: `rucia-offing-atlas-vi` or `rucia-tidelens-vi`

Atlas report hard gates:

- First screen follows the Yvette benchmark: client logo, diagnosis, direct conclusion, total score, visible stars, numeric star score, stage/type/confidence tiles, and three subscore bars.
- Mobile must not look like enlarged accessibility mode.
- Search mindshare cards sort by estimated demand size, not template order.
- Audience layers use a readable layered visual when relevant.
- VOC includes praise/complaint themes and business impact.
- Message-market fit rows include directional concern weight when used for scoring.
- Report-library score cards show raw score plus tier, distribution, and score sort when scores cluster.

## Copy Rules

Client-facing copy must be direct and operational:

- conclusion first
- concrete business objects, pages, channels, owners, metrics
- no internal process notes
- no phrases like `老板先看`, `给老板看的`, `经营系统`, `不能误判`, `不应算`, or `语气采用`

## Verification Checklist

For HTML changes:

- Check desktop light.
- Check mobile width around 390px.
- Confirm no horizontal overflow.
- Confirm logos/images load.
- Confirm counters match DOM counts.
- Confirm sort/filter interactions if the report library changed.
- Verify live content markers after push.

## Current Caution

There may be unrelated dirty work in `tidelens/index.html`. Leave it alone unless the task is explicitly about TideLens.
