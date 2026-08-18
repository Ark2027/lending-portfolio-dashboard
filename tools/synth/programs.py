"""Partner scoring, fee reconciliation and compliance document tracking.

The health score in here is a composite, and composites invite more confidence
than they deserve: several measures of differing reliability, rescaled onto an
arbitrary 0-100 and combined with weights somebody chose. It is useful for
deciding who to call first. It is not a rating, and the metric catalog says
so in the entry for it.
"""

from __future__ import annotations

import random
from collections import Counter, defaultdict
from datetime import date, timedelta

from .ledger import Loan, quarter_of
from .universe import PARTNERS, PARTNERS_BY_NAME, SEED

AS_OF = date(2026, 8, 17)
CURRENT_QUARTER = "2026Q3"

HEALTH_WEIGHTS = {
    "deployment": 0.25,
    "activity": 0.15,
    "portfolio": 0.25,
    "crm": 0.10,
    "compliance": 0.15,
    "ta": 0.10,
}

# Fictional business names for the fee reconciliation records. Assembled from
# word lists so nothing here can coincide with a real borrower.
_PREFIX = (
    "Ironwood", "Blue Harbor", "Cedar Gap", "Silver Fork", "Redstone", "Willow Bend",
    "Copper Creek", "Northline", "Sunfield", "Granite Hill", "Maple Row", "Kestrel",
    "Lantern", "Riverbend", "Ash Grove", "Foxglove", "Stonebridge", "Wildrye",
    "Amberline", "Quarry Road", "Pinecrest", "Tidewater", "Junction", "Hollow Oak",
)
_TRADE = (
    "Bakery", "Auto Works", "Landscaping", "Print Shop", "Fitness", "Dental",
    "Roofing", "Catering", "Logistics", "Welding", "Childcare", "Tailoring",
    "Coffee", "Plumbing", "Upholstery", "Bookkeeping", "Cleaning", "Barbers",
    "Nursery", "Electric", "Machine Shop", "Grocery", "Salon", "Framing",
)
_SUFFIX = ("LLC", "Inc", "Co", "Group", "Partners", "& Sons", "Holdings", "Services")


def _r2(x: float) -> float:
    return round(x + 0.0, 2)


def _rate(num: float, den: float) -> float:
    return _r2(100.0 * num / den) if den else 0.0


def _scale(value: float, low: float, high: float) -> float:
    """Map a value onto 0-100, clamped."""
    if high == low:
        return 50.0
    return _r2(max(0.0, min(100.0, 100.0 * (value - low) / (high - low))))


# --------------------------------------------------------------------------
# partner health
# --------------------------------------------------------------------------

def build_partner_health(loans: list[Loan], ta: dict, crm_by_partner: dict,
                         compliance: dict) -> dict:
    groups: dict[str, list[Loan]] = defaultdict(list)
    for loan in loans:
        groups[loan.partner].append(loan)

    disbursed = {p: sum(l.amount for l in rows) for p, rows in groups.items()}
    max_disbursed = max(disbursed.values()) if disbursed else 1.0

    recent_cutoff = AS_OF - timedelta(days=180)
    activity = {p: sum(1 for l in rows if l.originated >= recent_cutoff)
                for p, rows in groups.items()}
    max_activity = max(activity.values()) if activity else 1

    compliance_by_partner = {r["partner"]: r for r in compliance["by_partner"]}

    partners = []
    for name, rows in sorted(groups.items()):
        active = [l for l in rows if l.status == "active"]
        outstanding = sum(l.outstanding for l in active)
        co_amount = sum(l.chargeoff_amount for l in rows if l.status == "chargeoff")
        co_rate = _rate(co_amount, disbursed[name])
        max_dpd = max((l.days_past_due for l in active), default=0)
        inquiries = crm_by_partner.get(name, 0)
        ta_row = ta.get(name, {"businesses": 0, "hours": 0.0})
        comp = compliance_by_partner.get(name, {})

        components = {
            "deployment": _scale(disbursed[name], 0, max_disbursed),
            "activity": _scale(activity[name], 0, max_activity),
            # Lower charge-off is better, so this one inverts.
            "portfolio": _r2(max(0.0, 100.0 - co_rate * 9.0)),
            "crm": _scale(inquiries, 0, max(crm_by_partner.values()) if crm_by_partner else 1),
            "compliance": _r2(comp.get("compliance_score", 50.0)),
            "ta": _scale(ta_row["hours"], 0, max(t["hours"] for t in ta.values()) if ta else 1),
        }
        score = _r2(sum(components[k] * w for k, w in HEALTH_WEIGHTS.items()))
        tier = "strong" if score >= 70 else ("steady" if score >= 50 else "watch")

        partners.append({
            "partner": name,
            "health_score": score,
            "tier": tier,
            "components": components,
            "metrics": {
                "originations": len(rows),
                "disbursed": _r2(disbursed[name]),
                "outstanding": _r2(outstanding),
                "chargeoff_rate": co_rate,
                "crm_pre_screen": inquiries,
                "max_days_past_due": max_dpd,
                "ta_hours": _r2(ta_row["hours"]),
                "ta_businesses": int(ta_row["businesses"]),
            },
            "compliance": {
                "document_count": comp.get("document_count", 0),
                "certificate_year": comp.get("certificate_year"),
                "covenant_score": comp.get("metadata_score", 0),
                "covenant_capped": False,
                "metadata_score": comp.get("metadata_score", 0),
                "content_files_parsed": comp.get("content_files_parsed", 0),
            },
        })

    return {
        "method": "Weighted composite of six components, each rescaled to 0-100. Weights "
                  "were chosen by judgment, not fitted to an outcome, and the components "
                  "differ in reliability. Use it to rank where attention is needed, not as "
                  "a rating.",
        "weights": HEALTH_WEIGHTS,
        "partners": sorted(partners, key=lambda r: r["health_score"], reverse=True),
    }


# --------------------------------------------------------------------------
# fee reconciliation
# --------------------------------------------------------------------------

def _suggested_fee(amount: float) -> tuple[float, str]:
    """The regressive marketing fee schedule the front end also implements."""
    if amount <= 250_000:
        fee = min(amount * 0.025, 2_500)
        return _r2(fee), "2.5% capped at $2,500"
    if amount <= 500_000:
        return 3_000.0, "flat $3,000 tier"
    return 5_000.0, "flat $5,000 tier"


def _crm_variant(rng: random.Random, name: str) -> str:
    """How the same business tends to be typed into a different system.

    These are the variations the matcher has to see through: a dropped suffix,
    punctuated initialisms, an ampersand spelled out, a transposition.
    """
    base = name
    roll = rng.random()
    if roll < 0.22:
        for suffix in (" LLC", " Inc", " Co", " Group", " Partners", " Holdings", " Services"):
            if base.endswith(suffix):
                base = base[: -len(suffix)]
                break
    elif roll < 0.38 and base.endswith(" LLC"):
        base = base[:-4] + ", L.L.C."
    elif roll < 0.50:
        base = base.replace(" & ", " and ")
    elif roll < 0.60:
        base = base.upper()
    elif roll < 0.68 and len(base) > 8:
        i = rng.randrange(1, len(base) - 2)
        if base[i] != " " and base[i + 1] != " ":
            base = base[:i] + base[i + 1] + base[i] + base[i + 2:]
    return base


SIGNALS = ("state match", "lender match", "origination window", "name token overlap",
           "suffix normalized", "no conflicting candidate")

# What a reviewer wrote when they made the call. The note has to agree with the
# decision, or the audit trail argues with itself.
ACCEPT_NOTES = (
    "Confirmed against the origination report.",
    "Name variant accepted; state and lender both agree.",
    "Suffix difference only. Same business.",
    "",
)
REJECT_NOTES = (
    "Origination date precedes the lead. Not attributable.",
    "Different business at the same address.",
    "Same name, different state. Not a match.",
    "Lender code conflicts with the origination record.",
)


def _status_note(rng: random.Random, status: str) -> str:
    if status in ("billed", "confirmed"):
        return rng.choice(ACCEPT_NOTES)
    if status == "rejected":
        return rng.choice(REJECT_NOTES)
    return ""


def build_matcher(rng: random.Random, loans: list[Loan]) -> tuple[dict, list[dict]]:
    """Aggregate counts plus the record list the detail table renders.

    Every business name is assembled from fixed word lists, then deliberately
    varied to produce the CRM-side spelling. The matching logic this stands in
    for is published separately as entity-match-pipeline; what the dashboard
    shows is the outcome of a run, not the algorithm.
    """
    records = []
    used: set[str] = set()

    for index, loan in enumerate(loans):
        if rng.random() > 0.62:
            continue
        for _ in range(40):
            name = f"{rng.choice(_PREFIX)} {rng.choice(_TRADE)} {rng.choice(_SUFFIX)}"
            if name not in used:
                used.add(name)
                break

        score = rng.uniform(58, 100)
        if score >= 92:
            band = "auto_accept"
            status = rng.choices(["billed", "confirmed", "new"], [0.62, 0.26, 0.12])[0]
        elif score >= 78:
            band = "possible_match"
            status = rng.choices(["confirmed", "new", "billed", "rejected"],
                                 [0.31, 0.34, 0.16, 0.19])[0]
        else:
            band = "review"
            status = rng.choices(["rejected", "new"], [0.71, 0.29])[0]

        partner = PARTNERS_BY_NAME[loan.partner]
        quarter = quarter_of(loan.originated).replace("-", "")
        crm_name = _crm_variant(rng, name)
        fee, basis = _suggested_fee(loan.amount)
        lead_start = loan.originated - timedelta(days=rng.randint(35, 190))

        billed = status == "billed"
        decided = status in ("billed", "confirmed", "rejected")

        records.append({
            "match_key": f"M{index:05d}",
            "live_business_name": name,
            "crm_business_name": crm_name,
            "matched_live_variant": name.lower().replace(".", ""),
            "matched_candidate_variant": crm_name.lower().replace(".", ""),
            "lender_code": partner.short,
            "crm_cdfi_code": partner.short,
            "state": loan.state,
            "match_score": _r2(score),
            "decision_band": band,
            "status": status,
            "status_note": _status_note(rng, status),
            "status_updated_at": (AS_OF - timedelta(days=rng.randint(1, 120))).isoformat()
                                 if decided else None,
            "candidate_application_id": f"A{rng.randint(100000, 999999)}",
            "candidate_status": rng.choice(["approved", "approved", "in_progress"]),
            "supporting_signals": ", ".join(
                rng.sample(SIGNALS, rng.randint(2, 4))),
            "primary_origination_amount": _r2(loan.amount),
            "primary_origination_date": loan.originated.isoformat(),
            "origination_quarter": quarter,
            "quarter_first_seen": quarter,
            "lead_start_date": lead_start.isoformat(),
            "fee_amount": fee,
            "suggested_fee": fee,
            "fee_basis": basis,
            "billed_amount": fee if billed else None,
            "billed_quarter": quarter if billed else None,
            "invoice_date": (AS_OF - timedelta(days=rng.randint(3, 90))).isoformat()
                            if billed else None,
        })

    quarters = sorted({r["quarter_first_seen"] for r in records})

    billing_events = []
    for quarter in quarters[-6:]:
        rows = [r for r in records if r["billed_quarter"] == quarter]
        if not rows:
            continue
        billing_events.append({
            "invoice_file": f"marketing_invoices_{quarter}.csv",
            "created_at": (AS_OF - timedelta(days=rng.randint(5, 200))).isoformat(),
            "quarter": quarter,
            "count": len(rows),
            "total": _r2(sum(r["billed_amount"] or 0 for r in rows)),
        })

    block = {
        "available": True,
        "source_path": "data/fee_reconciliation.json",
        "status": dict(Counter(r["status"] for r in records)),
        "decision_band": dict(Counter(r["decision_band"] for r in records)),
        "lender_code": dict(Counter(r["lender_code"] for r in records)),
        "quarter_first_seen": dict(Counter(r["quarter_first_seen"] for r in records)),
        "issues": [],
        "total_matches": len(records),
    }
    return block, {"records": records, "quarters": quarters,
                   "billing_events": billing_events}


# --------------------------------------------------------------------------
# compliance documents
# --------------------------------------------------------------------------

DOC_TYPES = ("Certificate of good standing", "Audited financials", "Form 990",
             "Insurance certificate", "Board resolution", "Lending policy")

# Phrases the document scanner looks for, and how often each is actually found.
# A missing signal is not a compliance failure on its own; it means the scan
# could not confirm the phrase, which is a different claim and is scored as a
# smaller adjustment than a document being absent outright.
CONTENT_SIGNALS = (
    ("good_standing_language", 0.88),
    ("certified_language", 0.81),
    ("signed_language", 0.76),
    ("date_or_year_present", 0.94),
    ("audit_language", 0.72),
    ("unqualified_opinion_language", 0.64),
    ("going_concern_language", 0.12),
    ("form_990_language", 0.69),
    ("compliance_language", 0.83),
    ("waiver_or_exception_language", 0.18),
)


def build_compliance(rng: random.Random) -> dict:
    by_partner = []
    flags = []
    attempted = parsed = 0

    for partner in PARTNERS:
        counts = {t: rng.randint(1, 4) for t in DOC_TYPES}
        doc_count = sum(counts.values())
        cert_year = rng.choice([2024, 2025, 2025, 2026])
        audit_year = rng.choice([2024, 2024, 2025])
        f990_year = rng.choice([2023, 2024, 2024, 2025])

        att = doc_count
        par = max(0, att - rng.randint(0, 3))
        attempted += att
        parsed += par

        metadata_score = _r2(min(100.0, 55 + doc_count * 2.4 + (cert_year - 2024) * 8))
        adjustment = _r2(rng.uniform(-6, 9))
        score = _r2(max(0.0, min(100.0, metadata_score + adjustment)))

        by_partner.append({
            "partner": partner.name,
            "document_count": doc_count,
            "counts": counts,
            "latest_year": max(cert_year, audit_year, f990_year),
            "latest_modified": (AS_OF - timedelta(days=rng.randint(4, 300))).isoformat(),
            "certificate_year": cert_year,
            "audit_year": audit_year,
            "form_990_year": f990_year,
            "metadata_score": metadata_score,
            "content_score_adjustment": adjustment,
            "content_files_attempted": att,
            "content_files_parsed": par,
            "content_parse_failures": att - par,
            "content_parse_rate": _rate(par, att),
            "content_signals": {sig: rng.random() < prob for sig, prob in CONTENT_SIGNALS},
            "compliance_score": score,
        })

        for doc_type, year in (("Certificate of good standing", cert_year),
                               ("Audited financials", audit_year),
                               ("Form 990", f990_year)):
            years_old = AS_OF.year - year
            if years_old >= 1:
                flags.append({
                    "partner": partner.name,
                    "doc_type": doc_type,
                    "doc_year": year,
                    "years_old": years_old,
                    "is_stale": years_old >= 2,
                    "approaching_stale": years_old == 1,
                })

    stale = sum(1 for f in flags if f["is_stale"])
    issues = []
    if stale:
        issues.append({
            "source": "Compliance document store",
            "severity": "warning",
            "message": f"{stale} document(s) are two or more years old and past the "
                       f"staleness threshold.",
        })

    return {
        "available": True,
        "scanned_dirs": ["documents/partners", "documents/annual"],
        "eligible_file_count": attempted,
        "document_count": sum(r["document_count"] for r in by_partner),
        "content_files_attempted": attempted,
        "content_files_parsed": parsed,
        "content_parse_failures": attempted - parsed,
        "content_parse_rate": _rate(parsed, attempted),
        "by_partner": by_partner,
        "expiration_flags": sorted(flags, key=lambda f: -f["years_old"]),
        "issues": issues,
    }


# --------------------------------------------------------------------------
# quarterly financial covenants
# --------------------------------------------------------------------------

# Loan covenants a lender network typically holds its partners to. Each has a
# threshold and a direction: "min" passes at or above, "max" passes at or below.
COVENANTS = (
    ("net_asset_ratio", "Net asset ratio", 0.20, "min", "percent", (0.08, 0.62)),
    ("current_ratio", "Current ratio", 1.25, "min", "ratio", (0.80, 3.60)),
    ("change_in_net_assets", "Change in net assets", 0.0, "min", "percent", (-0.11, 0.19)),
    ("operating_liquidity", "Operating liquidity (months)", 3.0, "min", "months", (1.2, 11.5)),
    ("llr_ratio", "Loan loss reserve ratio", 0.05, "min", "percent", (0.02, 0.14)),
    ("net_charge_off_ratio", "Net charge-off ratio", 0.06, "max", "percent", (0.005, 0.095)),
)


def _format_ratio(value: float, fmt: str) -> str:
    if fmt == "percent":
        return f"{value * 100:.1f}%"
    if fmt == "months":
        return f"{value:.1f} mo"
    return f"{value:.2f}x"

ALL_QUARTERS = ("2024Q3", "2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4",
                "2026Q1", "2026Q2")


def build_quarterly_compliance(rng: random.Random) -> dict:
    orgs = []
    health = {}
    history = {}

    for partner in PARTNERS[:6]:
        key = partner.short.lower()
        assets = rng.uniform(8e6, 74e6)
        liabilities = assets * rng.uniform(0.28, 0.79)
        extracted = {
            "total_assets": _r2(assets),
            "total_liabilities": _r2(liabilities),
            "total_net_assets": _r2(assets - liabilities),
            "change_in_net_assets": _r2((assets - liabilities) * rng.uniform(-0.09, 0.16)),
            "loan_loss_allowance": _r2(assets * rng.uniform(0.02, 0.09)),
            "prior_loan_loss_allowance": _r2(assets * rng.uniform(0.02, 0.09)),
            "operating_revenue": _r2(rng.uniform(1.4e6, 12e6)),
            "operating_expense": _r2(rng.uniform(1.2e6, 11e6)),
            "cash_and_equivalents": _r2(assets * rng.uniform(0.06, 0.28)),
        }

        ratios = {}
        failed = []
        for key, label, threshold, direction, fmt, (low, high) in COVENANTS:
            value = round(rng.uniform(low, high), 4)
            passed = value >= threshold if direction == "min" else value <= threshold
            if not passed:
                failed.append(key)
            ratios[key] = {
                "key": key,
                "name": label,
                "value": value,
                "threshold": threshold,
                "direction": direction,
                "pass": passed,
                "display_format": fmt,
                "display_value": _format_ratio(value, fmt),
            }

        if not failed:
            status, risk = "pass", "low"
        elif len(failed) == 1:
            status, risk = "partial_fail", "moderate"
        else:
            status, risk = "fail", "high"

        # Rendered as a whole-number percentage, so it lives on a 0-100 scale.
        confidence = _r2(rng.uniform(58, 99))
        corrections = [
            f"{rng.choice(list(extracted))} re-read from the statement footnote"
            for _ in range(rng.randint(0, 2))
        ]
        warnings = [
            f"{rng.choice([c[1] for c in COVENANTS])} derived from a prior-period figure"
            for _ in range(rng.randint(0, 2))
        ]

        orgs.append({
            "org_id": key,
            "org_name": partner.name,
            "quarter": CURRENT_QUARTER,
            "financial_statement_status": "received",
            "source_pdfs": [f"{key}_{CURRENT_QUARTER}_financials.pdf"],
            "parse_confidence": confidence,
            "extracted_fields": extracted,
            "ratios": ratios,
            "overrides": {},
            "compliance_status": status,
            "failed_ratios": failed,
            "risk_level": risk,
            "certificate_status": "generated" if not failed else rng.choice(["pending", "error"]),
            "certificate_path": f"documents/partners/{key}/certificate.pdf",
            "waiver_status": "none" if not failed else rng.choice(["none", "requested", "granted"]),
            "waiver_path": None,
            "review_status": "auto" if confidence >= 90 else "needs_review",
            "validation_corrections": corrections,
            "validation_warnings": warnings,
        })

        base = rng.uniform(48, 94)
        health[key] = {"score": _r2(base), "capped": base > 90 and rng.random() < 0.5}
        span = ALL_QUARTERS[-rng.randint(4, 8):]
        history[key] = {
            q: _r2(max(20.0, min(100.0, base + rng.uniform(-14, 12))))
            for q in span
        }

    return {
        "available": True,
        "generated_at": f"{AS_OF.isoformat()}T04:05:00Z",
        "current_quarter": CURRENT_QUARTER,
        "organizations": orgs,
        "health_scores": health,
        "history": history,
        "all_quarters": list(ALL_QUARTERS),
    }


def build_google_ads() -> dict:
    """The paid-search page, in its unconfigured state.

    The demo has no ad account behind it, and inventing campaign performance
    would be the one number on this dashboard with no derivation. The page
    renders its empty state instead, which is what the real thing does when
    credentials are absent.
    """
    return {
        "available": True,
        "data_available": False,
        "refresh_status": "not_configured",
        "source": "Google Ads API",
        "dateRange": "LAST_30_DAYS",
        "timezone": "America/Chicago",
        "last_attempted_refresh_at": f"{AS_OF.isoformat()}T06:20:00Z",
        "last_successful_refresh_at": None,
        "issues": [{
            "source": "Paid search",
            "severity": "info",
            "message": "No advertising account is connected in the demo environment, so "
                       "this page shows its empty state rather than generated figures.",
        }],
        "missing_setup": ["developer_token", "customer_id"],
    }


def build(loans: list[Loan], ta: dict, crm_by_partner: dict) -> dict:
    rng = random.Random(SEED + 7)
    compliance = build_compliance(rng)
    matcher, matcher_records = build_matcher(rng, loans)
    return {
        "partner_health": build_partner_health(loans, ta, crm_by_partner, compliance),
        "compliance": compliance,
        "quarterly_compliance": build_quarterly_compliance(rng),
        "matcher": matcher,
        "google_ads": build_google_ads(),
        "_matcher_records": matcher_records,
    }
