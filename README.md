# Lending portfolio dashboard

[![tests](https://github.com/Ark2027/lending-portfolio-dashboard/actions/workflows/tests.yml/badge.svg)](https://github.com/Ark2027/lending-portfolio-dashboard/actions/workflows/tests.yml)

A ten-page analytics dashboard for a fictional network of community lenders, with the reporting-quality rules baked into the numbers rather than bolted on afterward.

**[Open the dashboard →](https://ark2027.github.io/lending-portfolio-dashboard/)**

No build step, no framework, no server. It's one HTML file, one stylesheet, one script, and four JSON files. Everything in it is synthetic.

## Why this exists

I audited a reporting pipeline that aggregated quarterly submissions from partner organizations into a dashboard, and the dashboard's figures went into board packs. The reconciliation came back perfect — every headline figure matched an independent read of the sources, to the cent.

The problems were all in the definitions. Percentages that double-counted people recorded in two categories. A rolling twelve-month window that quietly spanned fifteen months whenever a partner had a quiet period. A missing column rendering as `0%`, which on a chart looks identical to a genuine zero and means the opposite thing. Charge-off rates labeled "vintage" that were grouped by the quarter of the write-off rather than the quarter of origination.

I wrote that audit up separately, in [reporting-audit-case-study](https://github.com/Ark2027/reporting-audit-case-study). Two of its findings became tools: [impact-data-quality](https://github.com/Ark2027/impact-data-quality) and [snapshot-diff](https://github.com/Ark2027/snapshot-diff).

This repository is the third thing that came out of it, and the one that took the longest: a dashboard where those rules are the implementation, not a footnote. Coverage is displayed next to every share it belongs to. A field a partner never collected renders as **Missing**. Rolling windows are built on a complete calendar spine so an empty month cannot stretch them. Charge-offs are attributed to the cohort the loan was originated in. Estimates say they're estimates.

## The ten pages

### Executive Overview
The board-and-funder view. Capital deployed, states reached, jobs reported, partner count, and a reporting-readiness verdict. There's an **Internal / Board** toggle: internal mode shows the operational detail and the open warnings, board mode strips it back to what belongs in a pack. The narrative summary block is pre-written prose you can paste into a report, generated from the same figures the tiles use so it can't drift from them.

### CRM Funnel
Where inquiries come in and where they stop. A cumulative funnel from pre-screen through to funded, per-lender approval and denial rates, and a stage-abandonment chart showing where inquiries are left unrouted. Approval rates on recent months are understated by design, because in-progress inquiries sit in the denominator until they resolve — the KPI guide says so rather than smoothing it away.

### Geography
Two different maps of the same country. One is where capital was actually deployed; the other is where inquiries came from. They disagree, because inquiries arrive from every state and lending only happens inside partner footprints. The opportunity-gap table ranks states by market size against loans already funded there — a directional prompt for where to look, explicitly not a demand model.

### Impact & Portfolio
The heaviest page. Originations by partner, quarter and state; aging bands; charge-offs by cohort; job outcomes; advisory delivery; and the demographic tables. This is where the audit findings are most visible: every demographic share carries its coverage, minority counts are unique borrowers rather than a sum across overlapping columns, and one partner shows **Missing** for income band because it does not collect that field at all.

### Partner Health
A weighted composite score per lender across deployment, activity, portfolio quality, CRM volume, compliance and advisory. It's useful for deciding who to call first, and it isn't a rating — six measures of differing reliability, rescaled onto an arbitrary 0–100, combined with weights somebody chose. The metric catalog says exactly that in its entry.

### Marketing
Paid-search performance: campaigns, keywords, search terms, devices, dayparts, landing pages and auction insights. The most useful thing on it is the diagnostics strip, which flags that conversions here are application-page milestones and must not be reported as funded loans, and that ad-group naming does not reliably match the campaign it sits under, so any rollup keyed on the name attributes spend to the wrong lender.

### Fee Reconciliation
Matching originations in the loan book against inquiries in the CRM, so marketing fees can be billed. The two systems share no identifier and spell business names differently — `Willow Bend Roofing LLC` against `Willow Bend Roofing` — so matches get scored, banded into auto-accept / possible / review, and confirmed or rejected by a person whose note is kept with the decision. The matching engine itself is published separately as [entity-match-pipeline](https://github.com/Ark2027/entity-match-pipeline); this page is the outcome of a run. Confirmed rows export to CSV as an invoice.

### Advanced Analytics
Cohort and vintage curves, rolling twelve-month comparisons, concentration measures including HHI, capital recycling, and a linear projection two quarters out. The projection is deliberately unimpressive: a straight line through past quarters with no knowledge of pipeline or capital availability, labeled low confidence, shown to indicate direction and nothing more.

### KPI Guide
Every metric on the dashboard, with what it measures, the formula, the source, the grain, the refresh cadence, a confidence rating and a caveat. The confidence ratings are not uniform — they run from High for directly reconciled counts down to Low for cohort analytics and proxy scores. A dashboard that rates everything "high" isn't reporting confidence, it's decorating.

### Data Quality
The page that decides whether the others can be trusted. Source freshness per partner submission, coverage gaps, and twenty automated checks split into blocking and warning. Blocking means a figure would be wrong and the page cannot be certified. The current dataset ships with **one warning failing** — income-band coverage sits at 77% against an 80% target — because a dashboard that's always green isn't proving its checks work.

## Where the numbers come from

Everything derives from two generated ledgers:

```
tools/synth/universe.py    the fictional world: nine lenders, their footprints,
                           ticket sizes, credit quality, and which demographic
                           fields each one actually collects
tools/synth/ledger.py      1,413 loans and 13,898 inquiries drawn from those
                           distributions
```

Every figure the front end renders is computed from those rows. Nothing is written to a target number, which is the only way the totals, the partner splits, the quarterly series and the KPI tiles stay consistent with each other when a generator parameter changes. Change one lender's charge-off rate and the portfolio rate, the cohort curve, the partner health score and the credit warning all move together.

The seed is fixed, so regenerating produces a byte-identical result and the committed JSON stays reviewable in a diff.

**The data defects are deliberate.** The quality page only has something to say if some partners under-report, so the gaps are placed on purpose: one lender does not collect income band at all, another collects everything but leaves a third of it blank, a third joined two years into the series and backfilled its history a year after that. Those are the situations the checks exist to catch.

```bash
python tools/generate_demo_data.py
```

## Running it

Any static file server will do. There's nothing to install.

```bash
python -m http.server 8412 --directory src
```

Then open `http://localhost:8412`.

## Tests

```bash
python tests/test_dataset.py
```

34 tests, standard library only. They fall into two groups.

The first asserts the dataset is internally consistent — partner splits reconcile to portfolio totals within a cent, aging bands sum to outstanding, the monthly series is a complete sixty-month spine with no gaps, coverage denominators exclude partners who never collected the field, unique minority counts never exceed the naive column sum. Those are the same properties the data-quality page claims, so if they break, the page is lying.

The second asserts the published files carry nothing identifying: no real organization names, no credential-shaped strings, no absolute API paths left over from the version that had a backend.

There is also a staleness check. If `src/data` drifts from what the generator produces, the suite fails and tells you to re-run it.

## What I'd change

**The payload is one 705 KB file.** Every page loads all of it, including the four pages you may never open. Splitting it per page would cut first paint substantially. I kept it whole because the reconciliation guarantees only hold across the complete payload, and I'd rather ship something provably consistent than something fast and subtly disagreeing with itself. On a slow connection that is the wrong trade.

**Charts are hand-rolled SVG.** No charting library, which is why there is no build step and no dependency surface, but it also means each chart type was written once and is not especially reusable. A second dashboard would want a real charting layer.

**The paid-search page is the weakest.** Its figures are generated independently rather than derived from the ledgers, so unlike everything else it cannot be cross-checked against another page. It's the one section where a number could drift without a test catching it.

**Interactions do not persist.** Confirming or rejecting a match updates the page for the rest of your session and is gone on reload, because there's nowhere to write. The original wrote to SQLite.

## License

MIT
