"""Derive the CRM blocks from the application ledger.

The interesting constraint here is the bridge between inquiries and loans.
The generator knows which application became which loan, but the payload does
not expose that link, because the system this models could not join the two
either: the CRM and the loan book are separate systems with no shared key.

So the bridge is a ratio, it is labeled directional, and it carries the reason
the link is unavailable. Publishing it as though it were a true conversion rate
would be the same class of error the impact audit was about.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, timedelta

from .ledger import Application, Loan, month_range, quarter_of
from .universe import FIRST_MONTH, FUNNEL_STAGES, LAST_MONTH, PARTNERS, PARTNERS_BY_NAME

AS_OF = date(2026, 8, 17)
STATUSES = (
    "approved", "denied", "discarded", "in_progress",
    "unassigned", "archived", "sent_for_education",
)


def _r2(x: float) -> float:
    return round(x + 0.0, 2)


def _rate(num: float, den: float) -> float:
    return _r2(100.0 * num / den) if den else 0.0


def _funnel_rates(apps: list[Application]) -> list[dict]:
    """Status mix per lender, plus an unassigned row for inquiries never routed."""
    groups: dict[str, list[Application]] = defaultdict(list)
    for app in apps:
        groups[app.partner or "Unassigned"].append(app)

    out = []
    for name, rows in sorted(groups.items()):
        counts = Counter(a.status for a in rows)
        total = len(rows)
        active = counts["in_progress"] + counts["approved"]
        out.append({
            "cdfi": name,
            "total": total,
            "approved": counts["approved"],
            "denied": counts["denied"],
            "discarded": counts["discarded"],
            "in_progress": counts["in_progress"],
            "unassigned": counts["unassigned"],
            "archived": counts["archived"],
            "sent_for_education": counts["sent_for_education"],
            "approved_rate": _rate(counts["approved"], total),
            "denial_rate": _rate(counts["denied"], total),
            "discard_rate": _rate(counts["discarded"], total),
            "unassigned_rate": _rate(counts["unassigned"], total),
            "active_rate": _rate(active, total),
        })
    return sorted(out, key=lambda r: r["total"], reverse=True)


def _stage_status(apps: list[Application]) -> list[dict]:
    """Cumulative funnel: how many applications ever reached each stage."""
    order = {stage: i for i, stage in enumerate(FUNNEL_STAGES)}
    out = []
    for stage in FUNNEL_STAGES:
        reached = [a for a in apps if order[a.stage] >= order[stage]]
        counts = Counter(a.status for a in reached)
        for status in STATUSES:
            if counts[status]:
                out.append({"stage": stage, "status": status, "count": counts[status]})
    return out


def _monthly_pre_screen(apps: list[Application]) -> list[dict]:
    groups: dict[tuple[str, str, str], int] = Counter()
    for app in apps:
        groups[(app.created.strftime("%Y-%m"), app.status, app.partner or "Unassigned")] += 1
    return [
        {"month": m, "status": s, "cdfi": c, "count": n}
        for (m, s, c), n in sorted(groups.items())
    ]


def _daily_pre_screen(apps: list[Application]) -> list[dict]:
    """Daily detail, trimmed to the window the dashboard actually charts."""
    cutoff = AS_OF - timedelta(days=180)
    groups: dict[tuple[str, str, str], int] = Counter()
    for app in apps:
        if app.created < cutoff:
            continue
        groups[(app.created.isoformat(), app.status, app.partner or "Unassigned")] += 1
    return [
        {"date": d, "status": s, "cdfi": c, "count": n}
        for (d, s, c), n in sorted(groups.items())
    ]


def _bridge(apps: list[Application], loans: list[Loan]) -> dict:
    pre_screen = len(apps)
    approved = sum(1 for a in apps if a.status == "approved")
    disbursed = sum(l.amount for l in loans)

    by_partner = []
    app_counts = Counter(a.partner for a in apps if a.partner)
    loan_groups: dict[str, list[Loan]] = defaultdict(list)
    for loan in loans:
        loan_groups[loan.partner].append(loan)

    for name in sorted(set(app_counts) | set(loan_groups)):
        inquiries = app_counts.get(name, 0)
        rows = loan_groups.get(name, [])
        by_partner.append({
            "partner": name,
            "crm_pre_screen": inquiries,
            "live_originations": len(rows),
            "live_disbursed": _r2(sum(l.amount for l in rows)),
            "directional_originations_per_pre_screen": _r2(len(rows) / inquiries) if inquiries else None,
        })

    return {
        "method": "Ratio of loan-book originations to CRM inquiries over the same window, "
                  "computed per lender.",
        "direct_row_link_available": False,
        "reason": "The CRM and the loan book share no borrower or application identifier, "
                  "so an inquiry cannot be traced to the loan it became. These ratios "
                  "compare two independently counted populations and are directional only. "
                  "They are not a conversion rate and should not be quoted as one.",
        "totals": {
            "crm_pre_screen": pre_screen,
            "crm_approved": approved,
            "live_originations": len(loans),
            "live_disbursed": _r2(disbursed),
            "approved_share_of_pre_screen": _rate(approved, pre_screen),
            "directional_originations_per_pre_screen": _r2(len(loans) / pre_screen) if pre_screen else 0.0,
        },
        "by_partner": sorted(by_partner, key=lambda r: r["crm_pre_screen"], reverse=True),
    }


def _demand_supply_lag(apps: list[Application], loans: list[Loan]) -> dict:
    """Inquiry volume against originations at the same month, +3 and +6.

    Inquiries do not become loans in the month they arrive. Lining the two
    series up at a lag is the only way to look at them together, and even then
    it is a visual comparison rather than an attribution.
    """
    months = month_range(FIRST_MONTH, LAST_MONTH)
    index = {m: i for i, m in enumerate(months)}

    demand = Counter(a.created.strftime("%Y-%m") for a in apps)
    supply = Counter(l.originated.strftime("%Y-%m") for l in loans)

    crm_months = sorted(demand)[-24:]
    aligned = []
    for month in crm_months:
        i = index[month]
        aligned.append({
            "crm_month": month,
            "crm_demand": demand[month],
            "orig_t0": supply.get(months[i], 0) if i < len(months) else 0,
            "orig_t3": supply.get(months[i + 3], 0) if i + 3 < len(months) else None,
            "orig_t6": supply.get(months[i + 6], 0) if i + 6 < len(months) else None,
        })
    return {"available": True, "aligned_months": aligned}


def build_rds(apps: list[Application], loans: list[Loan], ta: dict) -> dict:
    status_by_cdfi: dict[tuple[str, str], int] = Counter()
    for app in apps:
        status_by_cdfi[(app.partner or "Unassigned", app.status)] += 1

    state_counts = Counter(a.state for a in apps)
    state_cdfi = Counter((a.state, a.partner or "Unassigned") for a in apps)

    co_loans = [l for l in loans if l.status == "chargeoff"]
    active = [l for l in loans if l.status == "active"]

    def _window(rows, key):
        dates = sorted(key(r) for r in rows if key(r) is not None)
        return (dates[0].isoformat(), dates[-1].isoformat()) if dates else (None, None)

    orig_min, orig_max = _window(loans, lambda l: l.originated)
    co_min, co_max = _window(co_loans, lambda l: l.chargeoff_date)

    return {
        "available": True,
        "data_available": True,
        "refresh_status": "ok",
        "using_cached_snapshot": False,
        "last_attempted_refresh_at": f"{AS_OF.isoformat()}T06:15:00Z",
        "last_successful_refresh_at": f"{AS_OF.isoformat()}T06:15:00Z",
        "exact_counts": {
            "application": len(apps),
            "business": len({a.app_id for a in apps}),
            "pre_screen_result": sum(1 for a in apps if a.risk_band != "MISSING"),
            "Origination": len(loans),
            "Aging Report": len(active),
            "Charge-off": len(co_loans),
            "TA": sum(int(t["businesses"]) for t in ta.values()),
        },
        "pre_screen_status_by_cdfi": [
            {"cdfi": c, "status": s, "count": n}
            for (c, s), n in sorted(status_by_cdfi.items())
        ],
        "risk": dict(Counter(a.risk_band for a in apps)),
        "soft_pull": dict(Counter(a.soft_pull for a in apps)),
        "stage_status": _stage_status(apps),
        "monthly_pre_screen": _monthly_pre_screen(apps),
        "daily_pre_screen": _daily_pre_screen(apps),
        "pre_screen_by_state": [
            {"state": s, "count": n} for s, n in sorted(state_counts.items())
        ],
        "pre_screen_by_state_cdfi": [
            {"state": s, "cdfi": c, "count": n}
            for (s, c), n in sorted(state_cdfi.items())
        ],
        "rds_impact": {
            "Origination": {
                "rows": len(loans),
                "total": _r2(sum(l.amount for l in loans)),
                "min_date": orig_min, "max_date": orig_max,
            },
            "Aging Report": {
                "rows": len(active),
                "total": _r2(sum(l.outstanding for l in active)),
                "min_date": orig_min, "max_date": orig_max,
            },
            "Charge-off": {
                "rows": len(co_loans),
                "total": _r2(sum(l.chargeoff_amount for l in co_loans)),
                "min_date": co_min, "max_date": co_max,
            },
            "TA": {
                "rows": sum(int(t["businesses"]) for t in ta.values()),
                "total": _r2(sum(t["hours"] for t in ta.values())),
                "min_date": orig_min, "max_date": orig_max,
            },
        },
        "issues": [],
    }


def build(apps: list[Application], loans: list[Loan], ta: dict) -> dict:
    monthly = Counter(a.created.strftime("%Y-%m") for a in apps)
    return {
        "rds": build_rds(apps, loans, ta),
        "crm_funnel_rates": _funnel_rates(apps),
        "crm_bridge": _bridge(apps, loans),
        "monthly_pre_screen_volume": [
            {"month": m, "count": n} for m, n in sorted(monthly.items())
        ],
        "demand_supply_lag": _demand_supply_lag(apps, loans),
    }
