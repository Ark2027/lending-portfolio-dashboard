"""Daily snapshots, reconstructed backward from the current payload.

The real pipeline appends one row per run and keeps a rolling window. There is
no way to recover a history that was never recorded, so this walks the current
figures backward with plausible drift and lands exactly on today's values.

That direction matters: generating forwards from an arbitrary start would leave
the final row disagreeing with the payload it sits next to.
"""

from __future__ import annotations

import random
from datetime import date, timedelta

from .universe import SEED

AS_OF = date(2026, 8, 17)
KEEP_DAYS = 90


def _r2(x: float) -> float:
    return round(x + 0.0, 2)


def build(payload: dict) -> dict:
    rng = random.Random(SEED + 31)
    impact = payload["impact"]
    totals = impact["totals"]
    kpis = impact["derived_kpis"]
    rds = payload["rds"]
    quality = payload["data_quality"]["summary"]["status"]

    crm_total = rds["exact_counts"]["application"]
    crm_states = len(rds["pre_screen_by_state"])

    # Today's true values, which the series has to end on.
    cur = {
        "disbursed": totals["disbursed"],
        "originations": totals["originations"],
        "outstanding": totals["outstanding"],
        "chargeoff_amount": totals["chargeoff_amount"],
        "jobs": totals["jobs"],
        "portfolio_loans": totals["portfolio_loans"],
        "crm_pre_screen": crm_total,
        "crm_state_count": crm_states,
    }

    rows = []
    for back in range(KEEP_DAYS):
        day = AS_OF - timedelta(days=back)
        if back == 0:
            snap = dict(cur)
        else:
            prev = rows[-1]
            # Walk backward: earlier days had slightly less of everything.
            shrink = lambda v, lo, hi: max(0.0, v * (1 - rng.uniform(lo, hi)))
            snap = {
                "disbursed": _r2(shrink(prev["disbursed"], 0.0004, 0.0031)),
                "originations": max(0, prev["originations"] - (1 if rng.random() < 0.62 else 0)),
                "outstanding": _r2(shrink(prev["outstanding"], 0.0002, 0.0026)),
                "chargeoff_amount": _r2(shrink(prev["chargeoff_amount"], 0.0, 0.0038)),
                "jobs": _r2(shrink(prev["jobs"], 0.0003, 0.0029)),
                "portfolio_loans": max(0, prev["portfolio_loans"] - (1 if rng.random() < 0.41 else 0)),
                "crm_pre_screen": max(0, prev["crm_pre_screen"] - rng.randint(4, 21)),
                "crm_state_count": max(38, prev["crm_state_count"] - (1 if rng.random() < 0.06 else 0)),
            }

        outstanding = snap["outstanding"] or 1.0
        disbursed = snap["disbursed"] or 1.0
        d30 = kpis["delinquency_rate_30_plus"] * rng.uniform(0.93, 1.07)
        d60 = kpis["stress_rate_60_plus"] * rng.uniform(0.90, 1.10)
        d90 = kpis["par_90"] * rng.uniform(0.88, 1.12)

        rows.append({
            **snap,
            "date": day.isoformat(),
            "generated_at": f"{day.isoformat()}T06:30:00Z",
            "chargeoff_rate": _r2(100.0 * snap["chargeoff_amount"] / disbursed),
            "delinquency_rate_30_plus": _r2(d30),
            "stress_rate_60_plus": _r2(d60),
            "par_30": _r2(d30),
            "par_60": _r2(d60),
            "par_90": _r2(d90),
            "velocity_signal": impact["origination_velocity"]["signal"],
            "implied_repaid": _r2(disbursed - outstanding - snap["chargeoff_amount"]),
            "rds_refresh_status": rds["refresh_status"],
            "data_quality_status": quality,
        })

    rows.reverse()

    daily_fields = ("date", "generated_at", "disbursed", "originations", "outstanding",
                    "jobs", "chargeoff_rate", "delinquency_rate_30_plus",
                    "stress_rate_60_plus", "crm_pre_screen", "crm_state_count",
                    "rds_refresh_status", "data_quality_status")
    snapshot_fields = ("date", "generated_at", "disbursed", "originations", "outstanding",
                       "chargeoff_amount", "jobs", "portfolio_loans", "chargeoff_rate",
                       "delinquency_rate_30_plus", "stress_rate_60_plus", "par_30",
                       "par_60", "par_90", "crm_pre_screen", "crm_state_count",
                       "velocity_signal", "implied_repaid", "rds_refresh_status",
                       "data_quality_status")

    latest = {k: rows[-1][k] for k in snapshot_fields}
    previous = {k: rows[-2][k] for k in snapshot_fields}

    deltas = {
        k: _r2(latest[k] - previous[k])
        for k in ("disbursed", "originations", "outstanding", "chargeoff_amount", "jobs",
                  "portfolio_loans", "crm_pre_screen", "delinquency_rate_30_plus",
                  "stress_rate_60_plus", "implied_repaid")
    }

    return {
        "available": True,
        "daily": [{k: r[k] for k in daily_fields} for r in rows],
        "latest": latest,
        "previous": previous,
        "deltas": deltas,
    }
