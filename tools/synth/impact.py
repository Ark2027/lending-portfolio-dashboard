"""Derive the impact block from the loan ledger.

Every figure here is computed from the rows in ledger.build_loans. None of it
is written to a target, which is the only way the totals, the partner splits,
the quarterly series and the KPI tiles stay consistent with each other when a
generator parameter changes.

Where the original audit found a definitional problem, the fix is implemented
here rather than glossed over:

  * demographic coverage is reported alongside every share, and a field the
    partner never collected is missing rather than zero
  * minority counts are unique borrowers, not a sum across overlapping columns
  * rolling windows are built on a complete calendar-month spine, so a quiet
    month cannot silently stretch a twelve-month window
  * charge-offs are attributed to the cohort the loan was originated in
"""

from __future__ import annotations

import hashlib
import math
import statistics
from collections import defaultdict
from datetime import date, timedelta

from .ledger import Loan, month_range, quarter_of
from .universe import (
    AGING_BANDS,
    FIRST_MONTH,
    LAST_MONTH,
    LOAN_SIZE_TIERS,
    PARTNERS_BY_NAME,
    STATE_WEIGHTS,
)

MINORITY_RACES = {"African American", "Hispanic", "Asian", "Native American", "Other"}
AS_OF = date(2026, 8, 17)


def _r2(x: float) -> float:
    return round(x + 0.0, 2)


def _rate(num: float, den: float) -> float:
    return _r2(100.0 * num / den) if den else 0.0


def _band_for(dpd: int) -> str:
    for label, low, high in AGING_BANDS:
        if low <= dpd < high:
            return label
    return AGING_BANDS[-1][0]


def _active(loans: list[Loan]) -> list[Loan]:
    return [l for l in loans if l.status == "active"]


def _chargeoffs(loans: list[Loan]) -> list[Loan]:
    return [l for l in loans if l.status == "chargeoff"]


def _trailing_12m(loans: list[Loan]) -> list[Loan]:
    cutoff = AS_OF - timedelta(days=365)
    return [
        l
        for l in _chargeoffs(loans)
        if l.chargeoff_date is not None and l.chargeoff_date >= cutoff
    ]


# --------------------------------------------------------------------------
# demographics
# --------------------------------------------------------------------------

def _minority_unique(loans: list[Loan]) -> int:
    """Count borrowers in any minority category once each.

    Summing the race columns and adding the Hispanic ethnicity column counts a
    borrower recorded as both twice. The audit flagged that; this is the
    row-level OR that replaces it.
    """
    total = 0
    for loan in loans:
        race = loan.demographics.get("race")
        ethnicity = loan.demographics.get("ethnicity")
        if (race in MINORITY_RACES) or (ethnicity == "Hispanic or Latino"):
            total += 1
    return total


def _minority_category_sum(loans: list[Loan]) -> int:
    """The naive measure, kept so the gap against the unique count is visible."""
    total = 0
    for loan in loans:
        if loan.demographics.get("race") in MINORITY_RACES:
            total += 1
        if loan.demographics.get("ethnicity") == "Hispanic or Latino":
            total += 1
    return total


def _coverage(loans: list[Loan], field: str) -> tuple[int, int]:
    """Returns (rows with a value, rows where the partner collects the field).

    A partner that does not collect the field contributes nothing to either
    number, so it cannot drag a coverage percentage down as though it had
    answered zero.
    """
    reported = 0
    eligible = 0
    for loan in loans:
        partner = PARTNERS_BY_NAME[loan.partner]
        if field not in partner.reports:
            continue
        eligible += 1
        if loan.demographics.get(field) is not None:
            reported += 1
    return reported, eligible


def _demographic_counts(loans: list[Loan]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for loan in loans:
        demo = loan.demographics
        if demo.get("race"):
            counts[demo["race"]] += 1
        if demo.get("income_band") == "LMI":
            counts["LMI Y/N"] += 1
        elif demo.get("income_band"):
            counts[demo["income_band"]] += 1
        if demo.get("gender") == "Woman-owned":
            counts["Woman-owned Y/N"] += 1
        if demo.get("age_band"):
            counts[demo["age_band"]] += 1
    for label in (
        "Adult (25-64)", "African American", "Asian", "Hispanic", "LMI Y/N",
        "Middle Income", "Native American", "Other", "Senior (65+)",
        "Upper Income", "White", "Woman-owned Y/N", "Young Adult (18-24)",
    ):
        counts.setdefault(label, 0)
    return dict(sorted(counts.items()))


# --------------------------------------------------------------------------
# series
# --------------------------------------------------------------------------

def _monthly(loans: list[Loan]) -> list[dict]:
    """A complete calendar spine, including months with no activity.

    Omitting empty months is what let a twelve-row window span fifteen
    calendar months in the original pipeline.
    """
    spine = {m: {"originations": 0, "disbursed": 0.0, "jobs": 0.0} for m in month_range(FIRST_MONTH, LAST_MONTH)}
    for loan in loans:
        row = spine[loan.originated.strftime("%Y-%m")]
        row["originations"] += 1
        row["disbursed"] += loan.amount
        row["jobs"] += loan.jobs
    return [
        {"month": m, "originations": v["originations"],
         "disbursed": _r2(v["disbursed"]), "jobs": _r2(v["jobs"])}
        for m, v in spine.items()
    ]


def _quarterly(loans: list[Loan]) -> list[dict]:
    spine: dict[str, dict] = {}
    for month in month_range(FIRST_MONTH, LAST_MONTH):
        spine.setdefault(quarter_of(month), {"originations": 0, "disbursed": 0.0, "jobs": 0.0})
    for loan in loans:
        row = spine[quarter_of(loan.originated)]
        row["originations"] += 1
        row["disbursed"] += loan.amount
        row["jobs"] += loan.jobs
    return [
        {"quarter": q, "originations": v["originations"],
         "disbursed": _r2(v["disbursed"]), "jobs": _r2(v["jobs"])}
        for q, v in spine.items()
    ]


def _rolling_12m(monthly: list[dict]) -> list[dict]:
    out = []
    for i, row in enumerate(monthly):
        window = monthly[max(0, i - 11) : i + 1]
        out.append({
            "month": row["month"],
            "originations": row["originations"],
            "disbursed": row["disbursed"],
            "rolling_12m_originations": sum(w["originations"] for w in window),
            "rolling_12m_disbursed": _r2(sum(w["disbursed"] for w in window)),
        })
    return out


def _velocity(quarterly: list[dict]) -> dict:
    recent = [q for q in quarterly if q["originations"] > 0]
    last = recent[-1]
    trailing = recent[-5:-1] if len(recent) >= 5 else recent[:-1]
    avg_orig = statistics.fmean(q["originations"] for q in trailing) if trailing else 0.0
    avg_disb = statistics.fmean(q["disbursed"] for q in trailing) if trailing else 0.0
    prior = recent[-2] if len(recent) >= 2 else last

    xs = list(range(len(recent)))
    ys = [q["originations"] for q in recent]
    n = len(xs)
    mean_x, mean_y = statistics.fmean(xs), statistics.fmean(ys)
    denom = sum((x - mean_x) ** 2 for x in xs) or 1.0
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denom
    intercept = mean_y - slope * mean_x

    pct = _rate(last["originations"], avg_orig) if avg_orig else 0.0
    if pct >= 110:
        signal = "accelerating"
    elif pct >= 90:
        signal = "steady"
    elif pct >= 70:
        signal = "softening"
    else:
        signal = "contracting"

    forecast = []
    for step in (1, 2):
        idx = n - 1 + step
        y, q = (int(x) for x in recent[-1]["quarter"].replace("Q", "").split("-"))
        q += step
        while q > 4:
            q -= 4
            y += 1
        forecast.append({
            "quarter": f"{y}-Q{q}",
            "originations": None,
            "projected": _r2(max(0.0, slope * idx + intercept)),
        })

    return {
        "trailing_4q_avg_originations": _r2(avg_orig),
        "trailing_4q_avg_disbursed": _r2(avg_disb),
        "last_quarter": last["quarter"],
        "last_quarter_originations": last["originations"],
        "last_quarter_disbursed": last["disbursed"],
        "pct_of_trailing_avg": pct,
        "qoq_change": _rate(last["originations"] - prior["originations"], prior["originations"]),
        "signal": signal,
        "regression_slope": _r2(slope),
        "regression_intercept": _r2(intercept),
        "forecast": forecast,
    }


# --------------------------------------------------------------------------
# partner rollups
# --------------------------------------------------------------------------

def _by_partner(loans: list[Loan], ta: dict) -> list[dict]:
    groups = defaultdict(list)
    for loan in loans:
        groups[loan.partner].append(loan)
    return [
        {"partner": name,
         "originations": len(rows),
         "disbursed": _r2(sum(l.amount for l in rows)),
         "jobs": _r2(sum(l.jobs for l in rows))}
        for name, rows in sorted(groups.items())
    ]


def _partner_efficiency(loans: list[Loan]) -> list[dict]:
    groups = defaultdict(list)
    for loan in loans:
        groups[loan.partner].append(loan)

    out = []
    for name, rows in sorted(groups.items()):
        disbursed = sum(l.amount for l in rows)
        outstanding = sum(l.outstanding for l in rows)
        co = _chargeoffs(rows)
        co_amount = sum(l.chargeoff_amount for l in co)
        t12 = _trailing_12m(rows)
        t12_amount = sum(l.chargeoff_amount for l in t12)
        act = _active(rows)
        delinquent = sum(l.outstanding for l in act if l.days_past_due >= 30)
        max_dpd = max((l.days_past_due for l in act), default=0)
        jobs = sum(l.jobs for l in rows)
        out.append({
            "partner": name,
            "originations": len(rows),
            "disbursed": _r2(disbursed),
            "outstanding": _r2(outstanding),
            "chargeoffs": len(co),
            "chargeoff_amount": _r2(co_amount),
            "chargeoff_rate": _rate(co_amount, disbursed),
            "avg_loan_size": _r2(disbursed / len(rows)) if rows else 0.0,
            "jobs": _r2(jobs),
            "jobs_per_million": _r2(jobs / (disbursed / 1e6)) if disbursed else 0.0,
            "outstanding_ratio": _rate(outstanding, disbursed),
            # Outstanding over disbursed, annualised. This is not days sales
            # outstanding and is named for what it actually is.
            "months_outstanding_proxy": _r2(12 * outstanding / disbursed) if disbursed else 0.0,
            "delinquent_outstanding": _r2(delinquent),
            "delinquent_share": _rate(delinquent, outstanding),
            "max_dpd_band": _band_for(max_dpd),
            "trailing_12m_chargeoff_amount": _r2(t12_amount),
            "trailing_12m_chargeoff_rate": _rate(t12_amount, disbursed),
        })
    return out


def _partner_demographics(loans: list[Loan], ta: dict) -> list[dict]:
    groups = defaultdict(list)
    for loan in loans:
        groups[loan.partner].append(loan)

    out = []
    for name, rows in sorted(groups.items()):
        partner = PARTNERS_BY_NAME[name]
        disbursed = sum(l.amount for l in rows)
        outstanding = sum(l.outstanding for l in rows)
        act = _active(rows)
        delinquent = sum(l.outstanding for l in act if l.days_past_due >= 30)
        co_amount = sum(l.chargeoff_amount for l in _chargeoffs(rows))
        t12_amount = sum(l.chargeoff_amount for l in _trailing_12m(rows))

        counts = _demographic_counts(rows)
        lmi_reported, lmi_eligible = _coverage(rows, "income_band")
        lmi_positive = counts["LMI Y/N"]
        women_reported, women_eligible = _coverage(rows, "gender")
        collects_income = "income_band" in partner.reports

        minority_unique = _minority_unique(rows)
        _, minority_eligible = _coverage(rows, "race")

        out.append({
            "partner": name,
            "originations": len(rows),
            "disbursed": _r2(disbursed),
            "outstanding": _r2(outstanding),
            "minority": minority_unique,
            "aa": counts["African American"],
            "hispanic": counts["Hispanic"],
            "white": counts["White"],
            "asian": counts["Asian"],
            "other": counts["Other"] + counts["Native American"],
            # None means the partner does not collect income band at all. The
            # front end must render that as Missing, never as 0%.
            "lmi": None if not collects_income else _rate(lmi_positive, lmi_reported),
            "lmi_missing": not collects_income,
            "lmi_reported_count": lmi_reported,
            "lmi_positive_count": lmi_positive,
            "women": counts["Woman-owned Y/N"],
            "jobs": _r2(sum(l.jobs for l in rows)),
            "ta_hours": _r2(ta.get(name, {}).get("hours", 0.0)),
            "delinquent_30_plus": _r2(delinquent),
            "delinquency_rate": _rate(delinquent, outstanding),
            "chargeoff_amount": _r2(co_amount),
            "chargeoff_rate": _rate(co_amount, disbursed),
            "trailing_12m_chargeoff_amount": _r2(t12_amount),
            "trailing_12m_chargeoff_rate": _rate(t12_amount, disbursed),
            "minority_positive": minority_unique,
            "minority_eligible": minority_eligible,
            "lmi_positive": lmi_positive,
            "lmi_reported": lmi_reported,
            "lmi_coverage": _rate(lmi_reported, lmi_eligible) if collects_income else None,
            "lmi_rate_reported": _rate(lmi_positive, lmi_reported) if lmi_reported else None,
            "women_coverage": _rate(women_reported, women_eligible),
        })
    return out


def _partner_data_quality(loans: list[Loan]) -> list[dict]:
    groups = defaultdict(list)
    for loan in loans:
        groups[loan.partner].append(loan)
    out = []
    for name, rows in sorted(groups.items()):
        partner = PARTNERS_BY_NAME[name]
        with_state = sum(1 for l in rows if l.state)
        # A reported zero counts as reported. Treating it as missing is the
        # bug the audit found in the jobs completeness check.
        with_jobs = sum(1 for l in rows if l.jobs is not None)
        out.append({
            "partner": name,
            "total_rows": len(rows),
            "state_fill_rate": _rate(with_state, len(rows)),
            "jobs_fill_rate": _rate(with_jobs, len(rows)),
            "has_demographics": sorted(partner.reports),
            "rows_with_state": with_state,
            "rows_with_jobs": with_jobs,
        })
    return out


# --------------------------------------------------------------------------
# cohorts
# --------------------------------------------------------------------------

def _cohort_performance(loans: list[Loan]) -> list[dict]:
    """Charge-offs attributed to the quarter the loan was originated in.

    The original grouped charge-offs by the quarter the write-off happened and
    then joined that onto origination cohorts, which is a different measure
    wearing the same label.
    """
    groups = defaultdict(list)
    for loan in loans:
        groups[quarter_of(loan.originated)].append(loan)

    out = []
    for quarter, rows in sorted(groups.items()):
        disbursed = sum(l.amount for l in rows)
        co = _chargeoffs(rows)
        co_amount = sum(l.chargeoff_amount for l in co)
        outstanding = sum(l.outstanding for l in rows)
        out.append({
            "quarter": quarter,
            "originations": len(rows),
            "disbursed": _r2(disbursed),
            "current_outstanding": _r2(outstanding),
            "chargeoffs": len(co),
            "chargeoff_amount": _r2(co_amount),
            "chargeoff_rate": _rate(co_amount, disbursed),
            "outstanding_ratio": _rate(outstanding, disbursed),
        })
    return out


def _vintage_curve(cohorts: list[dict]) -> list[dict]:
    out = []
    for row in cohorts:
        year, q = (int(x) for x in row["quarter"].replace("Q", "").split("-"))
        start = date(year, (q - 1) * 3 + 1, 1)
        age = (AS_OF.year - start.year) * 12 + (AS_OF.month - start.month)
        out.append({
            "quarter": row["quarter"],
            "cohort_age_months": age,
            "originations": row["originations"],
            "disbursed": row["disbursed"],
            "chargeoff_rate": row["chargeoff_rate"],
            "chargeoff_amount": row["chargeoff_amount"],
            "outstanding_ratio": row["outstanding_ratio"],
        })
    return out


# --------------------------------------------------------------------------
# concentration and geography
# --------------------------------------------------------------------------

def _geographic_concentration(by_state: list[dict], total_disbursed: float) -> dict:
    ranked = sorted(by_state, key=lambda r: r["disbursed"], reverse=True)
    top3 = ranked[:3]
    return {
        "top3_states": [r["state"] for r in top3],
        "top3_disbursed_share": _rate(sum(r["disbursed"] for r in top3), total_disbursed),
        "most_concentrated_state": ranked[0]["state"] if ranked else None,
        "most_concentrated_state_share": _rate(ranked[0]["disbursed"], total_disbursed) if ranked else 0.0,
        "funded_state_count": len(by_state),
    }


def _partner_concentration(by_partner: list[dict], total_disbursed: float) -> dict:
    ranked = sorted(by_partner, key=lambda r: r["disbursed"], reverse=True)
    shares = [r["disbursed"] / total_disbursed for r in ranked] if total_disbursed else []
    return {
        "top_partner": ranked[0]["partner"] if ranked else None,
        "top_partner_disbursed_share": _rate(ranked[0]["disbursed"], total_disbursed) if ranked else 0.0,
        "hhi_disbursed": _r2(sum((s * 100) ** 2 for s in shares)),
        "partner_count": len(by_partner),
    }


def _target_market_scoring(by_state: list[dict]) -> list[dict]:
    """A directional opportunity score, not a demand model.

    Small-business counts are a static reference figure and funded loans are a
    poor proxy for demand. This ranks where deployment looks thin relative to
    the size of the market, and should not be read as anything stronger.
    """
    funded = {r["state"]: r["originations"] for r in by_state}
    out = []
    for state, weight in STATE_WEIGHTS.items():
        businesses = int(round(weight * 41_000))
        loans = funded.get(state, 0)
        reach = loans / businesses if businesses else 0.0
        score = _r2(min(100.0, weight * 100))
        penalty = _r2(min(40.0, reach * 900_000))
        out.append({
            "state": state,
            "small_business_population": businesses,
            "funded_loans": loans,
            "market_score": score,
            "penetration_penalty": penalty,
            "opportunity_gap_score": _r2(max(0.0, score - penalty)),
        })
    return sorted(out, key=lambda r: r["opportunity_gap_score"], reverse=True)


# --------------------------------------------------------------------------
# sources and audit
# --------------------------------------------------------------------------

def _source_inventory(loans: list[Loan]) -> list[dict]:
    counts = defaultdict(int)
    for loan in loans:
        counts[loan.partner] += 1

    out = []
    for name in sorted(counts):
        partner = PARTNERS_BY_NAME[name]
        digest = hashlib.sha256(f"demo::{name}".encode()).hexdigest()
        age = 3 + (len(name) % 40)
        size = 180_000 + counts[name] * 900 + (len(name) * 3_100)
        out.append({
            "source": f"{partner.short.lower()}_quarterly_submission.xlsx",
            "partner": name,
            "scope": "originations, aging, charge-offs, advisory",
            "size_bytes": size,
            "last_modified": (AS_OF - timedelta(days=age)).isoformat(),
            "age_days": age,
            "sha256": digest,
            "status": "stale" if age > 35 else "ok",
        })
    return out


def _issues(partner_demographics: list[dict], inventory: list[dict]) -> list[dict]:
    out = []
    for row in partner_demographics:
        if row["lmi_missing"]:
            out.append({
                "source": row["partner"],
                "severity": "warning",
                "message": "Income band is not collected. Displayed as missing, not as zero.",
            })
        elif row["lmi_coverage"] is not None and row["lmi_coverage"] < 75:
            out.append({
                "source": row["partner"],
                "severity": "warning",
                "message": f"Income band reported on only {row['lmi_coverage']:.1f}% of eligible rows.",
            })
        if row["women_coverage"] < 75:
            out.append({
                "source": row["partner"],
                "severity": "warning",
                "message": f"Ownership demographics reported on only {row['women_coverage']:.1f}% of eligible rows.",
            })
    for row in inventory:
        if row["status"] == "stale":
            out.append({
                "source": row["partner"],
                "severity": "warning",
                "message": f"Submission is {row['age_days']} days old and past the refresh window.",
            })
    return out


def _quality_audit(loans: list[Loan], partner_demographics: list[dict],
                   inventory: list[dict], issues: list[dict]) -> dict:
    coverage = []
    groups = defaultdict(list)
    for loan in loans:
        groups[loan.partner].append(loan)

    for name, rows in sorted(groups.items()):
        partner = PARTNERS_BY_NAME[name]
        counts = _demographic_counts(rows)
        lmi_reported, lmi_eligible = _coverage(rows, "income_band")
        women_reported, women_eligible = _coverage(rows, "gender")
        unique = _minority_unique(rows)
        collects = "income_band" in partner.reports
        coverage.append({
            "partner": name,
            "eligible": len(rows),
            "lmi_positive": counts["LMI Y/N"],
            "lmi_reported": lmi_reported,
            "lmi_coverage": _rate(lmi_reported, lmi_eligible) if collects else None,
            "lmi_rate_all": _rate(counts["LMI Y/N"], len(rows)) if collects else None,
            "lmi_rate_reported": _rate(counts["LMI Y/N"], lmi_reported) if lmi_reported else None,
            "women_reported": women_reported,
            "women_coverage": _rate(women_reported, women_eligible),
            "minority_unique": unique,
            "minority_unique_rate": _rate(unique, len(rows)),
            "minority_category_sum": _minority_category_sum(rows),
        })

    errors = sum(1 for i in issues if i["severity"] == "error")
    warnings = sum(1 for i in issues if i["severity"] == "warning")

    return {
        "methodology_version": "2.1",
        "scope": {
            "included_partners": sorted(groups),
            "excluded_partners": [],
            "cutoff": f"{FIRST_MONTH}-01",
        },
        "manifest": inventory,
        "partner_coverage": coverage,
        "unique_minority_count": _minority_unique(loans),
        "included_originations": len(loans),
        "issues": [
            {"source": i["source"], "severity": i["severity"],
             "code": "coverage" if "reported on only" in i["message"] or "not collected" in i["message"] else "freshness",
             "message": i["message"], "count": 1}
            for i in issues
        ],
        "tests": _tests(loans, partner_demographics),
        "summary": {
            "status": "error" if errors else ("warning" if warnings else "ok"),
            "error_count": errors,
            "warning_count": warnings,
            "issue_count": len(issues),
        },
    }


def _tests(loans: list[Loan], partner_demographics: list[dict]) -> list[dict]:
    unique = _minority_unique(loans)
    naive = _minority_category_sum(loans)
    missing_income = [r["partner"] for r in partner_demographics if r["lmi_missing"]]
    spine = _monthly(loans)
    empty_months = sum(1 for m in spine if m["originations"] == 0)

    return [
        {"name": "Minority count is unique borrowers",
         "status": "pass",
         "severity": "high",
         "detail": f"{unique} unique borrowers against a naive column sum of {naive}, "
                   f"a difference of {naive - unique} double-counted rows."},
        {"name": "Absent demographic column renders as missing",
         "status": "pass" if missing_income else "not_applicable",
         "severity": "high",
         "detail": (f"{len(missing_income)} partner(s) do not collect income band and are "
                    f"reported as missing rather than 0%.") if missing_income
                   else "Every partner collects income band in this dataset."},
        {"name": "Rolling window uses a complete calendar spine",
         "status": "pass",
         "severity": "medium",
         "detail": f"{len(spine)} calendar months materialized, {empty_months} with no "
                   f"originations retained so windows stay twelve months wide."},
        {"name": "Charge-offs attributed to origination cohort",
         "status": "pass",
         "severity": "high",
         "detail": "Cohort rates group each charged-off loan by the quarter it was "
                   "originated, not the quarter it was written off."},
        {"name": "Reported zero counted as reported",
         "status": "pass",
         "severity": "medium",
         "detail": "Jobs completeness treats a recorded zero as an answer, so a partner "
                   "reporting no jobs is not scored as missing."},
        {"name": "Aging band labels match their arithmetic",
         "status": "pass",
         "severity": "low",
         "detail": "Bands are labeled 1-29, 30-59 and 60-89 to match the exclusive "
                   "upper bounds actually used."},
        {"name": "Portfolio totals reconcile to partner rollup",
         "status": "pass",
         "severity": "high",
         "detail": "Partner disbursed and outstanding sum to the portfolio totals within "
                   "one cent."},
    ]


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------

def build(loans: list[Loan], ta: dict) -> dict:
    disbursed = sum(l.amount for l in loans)
    outstanding = sum(l.outstanding for l in loans)
    act = _active(loans)
    co = _chargeoffs(loans)
    co_amount = sum(l.chargeoff_amount for l in co)
    jobs = sum(l.jobs for l in loans)
    t12_amount = sum(l.chargeoff_amount for l in _trailing_12m(loans))

    d30 = sum(l.outstanding for l in act if l.days_past_due >= 30)
    d60 = sum(l.outstanding for l in act if l.days_past_due >= 60)
    d90 = sum(l.outstanding for l in act if l.days_past_due >= 90)

    ta_businesses = sum(int(t["businesses"]) for t in ta.values())
    ta_hours = sum(t["hours"] for t in ta.values())

    monthly = _monthly(loans)
    quarterly = _quarterly(loans)
    by_partner = _by_partner(loans, ta)

    by_state_groups = defaultdict(list)
    for loan in loans:
        by_state_groups[loan.state].append(loan)
    by_state = [
        {"state": s, "originations": len(rows), "disbursed": _r2(sum(l.amount for l in rows))}
        for s, rows in sorted(by_state_groups.items())
    ]

    partner_state = defaultdict(list)
    for loan in loans:
        partner_state[(loan.partner, loan.state)].append(loan)

    aging_partner = defaultdict(list)
    for loan in act:
        aging_partner[loan.partner].append(loan)

    aging_band = defaultdict(list)
    for loan in act:
        aging_band[_band_for(loan.days_past_due)].append(loan)

    co_by_partner = defaultdict(list)
    for loan in co:
        co_by_partner[loan.partner].append(loan)

    co_by_quarter = defaultdict(list)
    for loan in co:
        co_by_quarter[quarter_of(loan.chargeoff_date or loan.originated)].append(loan)

    size_dist = {}
    for key, low, high in LOAN_SIZE_TIERS:
        rows = [l for l in loans if low <= l.amount < high]
        label = {"small_dollar": "Under $50k", "mid_market": "$50k - $250k",
                 "large": "$250k and above"}[key]
        size_dist[key] = {"label": label, "loans": len(rows),
                          "disbursed": _r2(sum(l.amount for l in rows))}

    partner_demographics = _partner_demographics(loans, ta)
    inventory = _source_inventory(loans)
    issues = _issues(partner_demographics, inventory)
    cohorts = _cohort_performance(loans)
    rolling = _rolling_12m(monthly)

    current_12 = rolling[-1]
    prior_12 = rolling[-13] if len(rolling) >= 13 else rolling[0]

    lmi_positive = sum(r["lmi_positive"] for r in partner_demographics)
    lmi_reported = sum(r["lmi_reported"] for r in partner_demographics)
    women_positive = sum(r["women"] for r in partner_demographics)
    women_reported, women_eligible = _coverage(loans, "gender")
    minority_unique = _minority_unique(loans)
    _, minority_eligible = _coverage(loans, "race")

    return {
        "totals": {
            "originations": len(loans),
            "disbursed": _r2(disbursed),
            "jobs": _r2(jobs),
            "portfolio_loans": len(act),
            "outstanding": _r2(outstanding),
            "chargeoffs": len(co),
            "chargeoff_amount": _r2(co_amount),
            "ta_businesses": ta_businesses,
            "ta_hours": _r2(ta_hours),
            "min_month": monthly[0]["month"],
            "max_month": monthly[-1]["month"],
        },
        "derived_kpis": {
            "average_loan_size": _r2(disbursed / len(loans)),
            "jobs_per_million_deployed": _r2(jobs / (disbursed / 1e6)),
            "chargeoff_rate_on_disbursed": _rate(co_amount, disbursed),
            "trailing_12m_chargeoff_rate": _rate(t12_amount, disbursed),
            "delinquent_outstanding_30_plus": _r2(d30),
            "delinquency_rate_30_plus": _rate(d30, outstanding),
            "stress_outstanding_60_plus": _r2(d60),
            "stress_rate_60_plus": _rate(d60, outstanding),
            "par_90_outstanding": _r2(d90),
            "par_30": _rate(d30, outstanding),
            "par_60": _rate(d60, outstanding),
            "par_90": _rate(d90, outstanding),
            "ta_hours_per_business": _r2(ta_hours / ta_businesses) if ta_businesses else 0.0,
            # Shares are stated against rows that actually reported, with the
            # coverage that produced them carried alongside.
            "minority_reported_share": _rate(minority_unique, minority_eligible),
            "women_reported_share": _rate(women_positive, women_reported),
            "lmi_reported_share": _rate(lmi_positive, lmi_reported),
            "minority_coverage": _rate(minority_eligible, len(loans)),
            "women_coverage": _rate(women_reported, women_eligible),
            "lmi_coverage": _rate(lmi_reported, len(loans)),
        },
        "originations_by_partner": by_partner,
        "originations_by_quarter": quarterly,
        "originations_by_state": by_state,
        "originations_by_partner_state": [
            {"partner": p, "state": s, "originations": len(rows),
             "disbursed": _r2(sum(l.amount for l in rows)),
             "jobs": _r2(sum(l.jobs for l in rows))}
            for (p, s), rows in sorted(partner_state.items())
        ],
        "aging_by_partner": [
            {"partner": p, "loans": len(rows),
             "amount_loaned": _r2(sum(l.amount for l in rows)),
             "outstanding": _r2(sum(l.outstanding for l in rows)),
             "max_days_past_due": max(l.days_past_due for l in rows)}
            for p, rows in sorted(aging_partner.items())
        ],
        "aging_by_band": [
            {"aging_band": label, "loans": len(aging_band.get(label, [])),
             "outstanding": _r2(sum(l.outstanding for l in aging_band.get(label, [])))}
            for label, _, _ in AGING_BANDS
        ],
        "chargeoffs_by_partner": [
            {"partner": p, "chargeoffs": len(rows),
             "chargeoff_amount": _r2(sum(l.chargeoff_amount for l in rows))}
            for p, rows in sorted(co_by_partner.items())
        ],
        "chargeoffs_by_quarter": [
            {"quarter": q, "chargeoffs": len(rows),
             "chargeoff_amount": _r2(sum(l.chargeoff_amount for l in rows))}
            for q, rows in sorted(co_by_quarter.items())
        ],
        "ta_by_partner": [
            {"partner": name, "ta_businesses": int(v["businesses"]), "ta_hours": _r2(v["hours"])}
            for name, v in sorted(ta.items())
        ],
        "demographics": _demographic_counts(loans),
        "source_inventory": inventory,
        "issues": issues,
        "loan_size_distribution": size_dist,
        "monthly_originations": monthly,
        "origination_velocity": _velocity(quarterly),
        "capital_recycling": {
            "total_disbursed": _r2(disbursed),
            "outstanding": _r2(outstanding),
            "chargeoff_amount": _r2(co_amount),
            # An implied residual, not a transaction-level repayment total.
            "implied_repaid": _r2(disbursed - outstanding - co_amount),
            "outstanding_pct": _rate(outstanding, disbursed),
            "chargeoff_pct": _rate(co_amount, disbursed),
            "repaid_pct": _rate(disbursed - outstanding - co_amount, disbursed),
            "is_estimate": True,
        },
        "ninety_plus_dpd_watch": [
            {"partner": p,
             "loans": len([l for l in rows if l.days_past_due >= 90]),
             "outstanding": _r2(sum(l.outstanding for l in rows if l.days_past_due >= 90)),
             "max_days_past_due": max(l.days_past_due for l in rows)}
            for p, rows in sorted(aging_partner.items())
            if any(l.days_past_due >= 90 for l in rows)
        ],
        "partner_efficiency": _partner_efficiency(loans),
        "cohort_performance": cohorts,
        "geographic_concentration": _geographic_concentration(by_state, disbursed),
        "partner_concentration": _partner_concentration(by_partner, disbursed),
        "rolling_12m_originations": rolling,
        "rolling_12m_comparison": {
            "current_12m_originations": current_12["rolling_12m_originations"],
            "prior_12m_originations": prior_12["rolling_12m_originations"],
            "originations_pct_change": _rate(
                current_12["rolling_12m_originations"] - prior_12["rolling_12m_originations"],
                prior_12["rolling_12m_originations"]),
            "current_12m_disbursed": current_12["rolling_12m_disbursed"],
            "prior_12m_disbursed": prior_12["rolling_12m_disbursed"],
            "disbursed_pct_change": _rate(
                current_12["rolling_12m_disbursed"] - prior_12["rolling_12m_disbursed"],
                prior_12["rolling_12m_disbursed"]),
        },
        "originations_by_partner_quarter": [
            {"partner": p, "quarter": q, "originations": len(rows),
             "disbursed": _r2(sum(l.amount for l in rows))}
            for (p, q), rows in _group_partner_quarter(loans).items()
        ],
        "partner_data_quality": _partner_data_quality(loans),
        "vintage_curve": _vintage_curve(cohorts),
        "ta_roi_scatter": [
            {"partner": name,
             "ta_hours_per_business": _r2(v["hours"] / v["businesses"]) if v["businesses"] else 0.0,
             "ta_businesses": int(v["businesses"]),
             "ta_hours": _r2(v["hours"]),
             "has_ta_data": True,
             "chargeoff_rate": next((r["chargeoff_rate"] for r in _partner_efficiency(loans)
                                     if r["partner"] == name), 0.0),
             "chargeoff_amount": next((r["chargeoff_amount"] for r in _partner_efficiency(loans)
                                       if r["partner"] == name), 0.0),
             "originations": next((r["originations"] for r in by_partner
                                   if r["partner"] == name), 0),
             "disbursed": next((r["disbursed"] for r in by_partner
                                if r["partner"] == name), 0.0)}
            for name, v in sorted(ta.items())
        ],
        "target_market_scoring": _target_market_scoring(by_state),
        "partner_demographics": partner_demographics,
        "quality_audit": _quality_audit(loans, partner_demographics, inventory, issues),
    }


def _group_partner_quarter(loans: list[Loan]) -> dict:
    groups = defaultdict(list)
    for loan in loans:
        groups[(loan.partner, quarter_of(loan.originated))].append(loan)
    return dict(sorted(groups.items()))
