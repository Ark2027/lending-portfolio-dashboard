"""Generate the two fictional ledgers every dashboard figure is derived from.

There are only two source objects:

    loans         one row per origination, with its current portfolio state
    applications  one row per pre-screen inquiry, with the stage it reached

Every aggregate the front end renders is computed from these. Nothing in the
payload is hand-written to a target number, because hand-written aggregates
stop agreeing with each other the moment you change one of them.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import date, timedelta

from .universe import (
    AGE_OPTIONS,
    CRM_STATE_WEIGHTS,
    FIRST_MONTH,
    GENDER_OPTIONS,
    INCOME_OPTIONS,
    LAST_MONTH,
    PARTNERS,
    RACE_OPTIONS,
    SEED,
    STAGE_PASS_RATE,
    STATE_WEIGHTS,
    VETERAN_OPTIONS,
    Partner,
)

TERM_MONTHS = 60
TOTAL_LOANS = 1_412
TOTAL_APPLICATIONS = 13_900


@dataclass
class Loan:
    loan_id: str
    partner: str
    state: str
    originated: date
    amount: float
    jobs: float
    status: str  # active | repaid | chargeoff
    outstanding: float
    days_past_due: int
    chargeoff_amount: float
    chargeoff_date: date | None
    demographics: dict[str, str | None]


@dataclass
class Application:
    app_id: str
    created: date
    state: str
    partner: str | None
    stage: str
    funded_loan_id: str | None
    # Workflow status, which is not the same thing as funnel stage: an
    # application can sit at "Referred to Lender" while its status is archived.
    status: str
    risk_band: str
    soft_pull: str


def month_range(first: str, last: str) -> list[str]:
    """Every calendar month from first to last inclusive, as YYYY-MM."""
    fy, fm = (int(x) for x in first.split("-"))
    ly, lm = (int(x) for x in last.split("-"))
    out = []
    y, m = fy, fm
    while (y, m) <= (ly, lm):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def quarter_of(d: date | str) -> str:
    if isinstance(d, str):
        y, m = (int(x) for x in d.split("-")[:2])
    else:
        y, m = d.year, d.month
    return f"{y}-Q{(m - 1) // 3 + 1}"


def _weighted(rng: random.Random, options) -> str:
    total = sum(w for _, w in options)
    pick = rng.uniform(0, total)
    running = 0.0
    for label, weight in options:
        running += weight
        if pick <= running:
            return label
    return options[-1][0]


def _months_between(a: str, b: str) -> int:
    ay, am = (int(x) for x in a.split("-"))
    by, bm = (int(x) for x in b.split("-"))
    return (by - ay) * 12 + (bm - am)


def _partner_is_active(partner: Partner, month: str) -> bool:
    """A partner contributes rows from the quarter it joined onward.

    Its backfill quarter is handled separately: the rows exist all along, but
    they only *appear* in the reported series once the backfill lands.
    """
    if partner.joined is None:
        return True
    jy, jq = partner.joined.split("-Q")
    join_month = f"{int(jy):04d}-{(int(jq) - 1) * 3 + 1:02d}"
    return _months_between(join_month, month) >= 0


def _volume_curve(index: int, span: int) -> float:
    """Origination volume ramps and then flattens, with a Q4 bump."""
    ramp = 0.45 + 0.75 * (1 - math.exp(-2.6 * index / span))
    month = (index % 12) + 1
    seasonal = 1.18 if month in (10, 11, 12) else 0.92 if month in (1, 2) else 1.0
    return ramp * seasonal


def _draw_amount(rng: random.Random, partner: Partner) -> float:
    raw = rng.lognormvariate(math.log(partner.ticket_median), partner.ticket_spread)
    return round(min(max(raw, 5_000), 850_000), 2)


def _draw_jobs(rng: random.Random, amount: float) -> float:
    """Jobs scale sublinearly with capital, with real spread and honest zeros."""
    base = 3.6 * (amount / 50_000) ** 0.62
    noise = rng.lognormvariate(0, 0.55)
    value = base * noise
    if rng.random() < 0.08:
        # A reported zero is a real answer, not a missing one.
        return 0.0
    return round(value, 2)


def _draw_demographics(rng: random.Random, partner: Partner) -> dict[str, str | None]:
    """Fill only the fields this partner collects, with its blank rate applied.

    A field the partner does not collect is None, and so is a field it collects
    but left empty on this row. The two look identical here on purpose; the
    difference is recoverable from the partner's reports set, which is exactly
    the distinction the coverage checks have to make.
    """
    out: dict[str, str | None] = {}
    for field_name, options in (
        ("race", RACE_OPTIONS),
        ("gender", GENDER_OPTIONS),
        ("income_band", INCOME_OPTIONS),
        ("age_band", AGE_OPTIONS),
        ("veteran", VETERAN_OPTIONS),
    ):
        if field_name not in partner.reports:
            out[field_name] = None
        elif rng.random() < partner.blank_rate:
            out[field_name] = None
        else:
            out[field_name] = _weighted(rng, options)
    # Ethnicity is recorded separately from race, and a borrower can be in
    # both, which is the double-counting the minority share has to avoid.
    if "ethnicity" not in partner.reports:
        out["ethnicity"] = None
    elif rng.random() < partner.blank_rate:
        out["ethnicity"] = None
    else:
        out["ethnicity"] = "Hispanic or Latino" if rng.random() < 0.21 else "Not Hispanic or Latino"
    return out


def _resolve_status(
    rng: random.Random, partner: Partner, amount: float, age_months: int
) -> tuple[str, float, int, float, date | None]:
    """Decide where a loan ended up given how long it has been on the books."""
    maturity = min(age_months / TERM_MONTHS, 1.0)

    chargeoff_pressure = partner.chargeoff * (1 - math.exp(-2.2 * maturity)) * 4.6
    if rng.random() < chargeoff_pressure:
        # Charge-offs take the remaining balance, not the original amount.
        remaining = amount * max(0.25, 1 - maturity * rng.uniform(0.4, 0.9))
        return "chargeoff", 0.0, 0, round(remaining, 2), None

    if maturity >= 1.0 or rng.random() < maturity ** 2.4:
        return "repaid", 0.0, 0, 0.0, None

    outstanding = amount * (1 - maturity) * rng.uniform(0.88, 1.04)
    outstanding = round(max(outstanding, 250.0), 2)

    dpd = 0
    if rng.random() < partner.delinquency * 1.7:
        band = rng.random()
        if band < 0.52:
            dpd = rng.randint(1, 29)
        elif band < 0.78:
            dpd = rng.randint(30, 59)
        elif band < 0.91:
            dpd = rng.randint(60, 89)
        else:
            dpd = rng.randint(90, 240)
    return "active", outstanding, dpd, 0.0, None


def build_loans(rng: random.Random) -> list[Loan]:
    months = month_range(FIRST_MONTH, LAST_MONTH)
    span = len(months)

    # Work out how many loans land in each month, then who booked them.
    monthly_weight = [_volume_curve(i, span) for i in range(span)]
    weight_total = sum(monthly_weight)

    loans: list[Loan] = []
    counter = 1
    for index, month in enumerate(months):
        count = round(TOTAL_LOANS * monthly_weight[index] / weight_total)
        eligible = [p for p in PARTNERS if _partner_is_active(p, month)]
        if not eligible:
            continue
        weights = [p.weight for p in eligible]
        for _ in range(count):
            partner = rng.choices(eligible, weights=weights, k=1)[0]
            year, mon = (int(x) for x in month.split("-"))
            last_day = (date(year + (mon == 12), (mon % 12) + 1, 1) - timedelta(days=1)).day
            originated = date(year, mon, rng.randint(1, last_day))

            state = rng.choices(
                list(partner.states),
                weights=[STATE_WEIGHTS.get(s, 0.1) for s in partner.states],
                k=1,
            )[0]

            amount = _draw_amount(rng, partner)
            age = _months_between(month, LAST_MONTH)
            status, outstanding, dpd, co_amount, co_date = _resolve_status(
                rng, partner, amount, age
            )
            if status == "chargeoff":
                offset = rng.randint(max(6, age // 3), max(7, age)) if age > 7 else age
                co_date = originated + timedelta(days=offset * 30)

            loans.append(
                Loan(
                    loan_id=f"L{counter:05d}",
                    partner=partner.name,
                    state=state,
                    originated=originated,
                    amount=amount,
                    jobs=_draw_jobs(rng, amount),
                    status=status,
                    outstanding=outstanding,
                    days_past_due=dpd,
                    chargeoff_amount=co_amount,
                    chargeoff_date=co_date,
                    demographics=_draw_demographics(rng, partner),
                )
            )
            counter += 1
    return loans


def build_ta(rng: random.Random, loans: list[Loan]) -> dict[str, dict[str, float]]:
    """Advisory delivery, counted per partner rather than per loan.

    Technical assistance is not an attribute of a loan. Most businesses that
    receive advice never borrow, so TA business counts run several times the
    loan count and the two must not be divided into each other casually.
    """
    counts: dict[str, int] = {}
    for loan in loans:
        counts[loan.partner] = counts.get(loan.partner, 0) + 1

    out: dict[str, dict[str, float]] = {}
    for partner in PARTNERS:
        loan_count = counts.get(partner.name, 0)
        if not loan_count:
            continue
        businesses = round(loan_count * partner.ta_reach * rng.uniform(0.88, 1.12))
        hours = sum(
            max(0.25, rng.lognormvariate(math.log(partner.ta_intensity), 0.75))
            for _ in range(businesses)
        )
        out[partner.name] = {
            "businesses": businesses,
            "hours": round(hours, 2),
        }
    return out


def build_applications(rng: random.Random, loans: list[Loan]) -> list[Application]:
    """Pre-screen inquiries, with the funded tail linked back to real loans.

    The link exists in the generator but is deliberately *not* exposed in the
    payload, because the system this models could not join CRM rows to loan
    rows either. The bridge has to be an estimate, and saying so is the point.
    """
    months = month_range(FIRST_MONTH, LAST_MONTH)
    # CRM coverage starts later than the loan book; the pre-screen tool was
    # introduced part-way through.
    crm_months = months[len(months) - 47 :]
    span = len(crm_months)

    funded_by_month: dict[str, list[Loan]] = {}
    for loan in loans:
        funded_by_month.setdefault(loan.originated.strftime("%Y-%m"), []).append(loan)

    weights = [_volume_curve(i, span) * rng.uniform(0.85, 1.15) for i in range(span)]
    weight_total = sum(weights)

    apps: list[Application] = []
    counter = 1
    states = list(CRM_STATE_WEIGHTS)
    state_weights = list(CRM_STATE_WEIGHTS.values())

    for index, month in enumerate(crm_months):
        count = round(TOTAL_APPLICATIONS * weights[index] / weight_total)
        year, mon = (int(x) for x in month.split("-"))
        last_day = (date(year + (mon == 12), (mon % 12) + 1, 1) - timedelta(days=1)).day

        month_funded = list(funded_by_month.get(month, []))
        rng.shuffle(month_funded)

        for _ in range(count):
            created = date(year, mon, rng.randint(1, last_day))
            state = rng.choices(states, weights=state_weights, k=1)[0]

            # Walk the funnel until it drops out.
            reached = "Pre-Screen Started"
            for stage, rate in STAGE_PASS_RATE.items():
                if rng.random() > rate:
                    break
                reached = _next_stage(stage)

            # Routing happens once the pre-screen completes, so only inquiries
            # that never finished one are left without a lender.
            partner = None
            funded_loan_id = None
            if reached != "Pre-Screen Started":
                eligible = [p for p in PARTNERS if state in p.states and _partner_is_active(p, month)]
                pool = eligible or [p for p in PARTNERS if _partner_is_active(p, month)]
                partner = rng.choices(pool, weights=[p.weight for p in pool], k=1)[0].name

            if reached == "Closed / Funded" and month_funded:
                match = next((l for l in month_funded if l.partner == partner), None)
                if match is not None:
                    month_funded.remove(match)
                    funded_loan_id = match.loan_id
                    state = match.state

            risk_band, soft_pull = _draw_risk(rng, reached)
            apps.append(
                Application(
                    app_id=f"A{counter:06d}",
                    created=created,
                    state=state,
                    partner=partner,
                    stage=reached,
                    funded_loan_id=funded_loan_id,
                    status=_draw_status(rng, reached),
                    risk_band=risk_band,
                    soft_pull=soft_pull,
                )
            )
            counter += 1
    return apps


def _draw_status(rng: random.Random, stage: str) -> str:
    """Where an application ended up in the workflow, given how far it got."""
    if stage == "Closed / Funded":
        return "approved"
    if stage == "Approved":
        return "approved" if rng.random() < 0.72 else "in_progress"
    if stage in ("Underwriting", "Application Submitted"):
        roll = rng.random()
        return "in_progress" if roll < 0.63 else ("denied" if roll < 0.88 else "discarded")
    if stage == "Referred to Lender":
        roll = rng.random()
        if roll < 0.34:
            return "in_progress"
        if roll < 0.62:
            return "denied"
        if roll < 0.83:
            return "sent_for_education"
        return "discarded"
    if stage == "Pre-Screen Complete":
        roll = rng.random()
        if roll < 0.41:
            return "denied"
        if roll < 0.66:
            return "sent_for_education"
        if roll < 0.87:
            return "discarded"
        return "archived"
    roll = rng.random()
    if roll < 0.47:
        return "unassigned"
    if roll < 0.79:
        return "discarded"
    return "archived"


def _draw_risk(rng: random.Random, stage: str) -> tuple[str, str]:
    """Credit screen outcome. Applications that stall early often never got one."""
    early = stage in ("Pre-Screen Started", "Pre-Screen Complete")
    if early and rng.random() < 0.38:
        return ("MISSING", "no-hit") if rng.random() < 0.55 else ("NO_BUREAU_REPORT", "No Bureau Report")
    roll = rng.random()
    if roll < 0.44:
        band = "LOW"
    elif roll < 0.79:
        band = "MEDIUM"
    else:
        band = "HIGH"
    pull = "Success" if rng.random() < 0.93 else "failure"
    return band, pull


def _next_stage(stage: str) -> str:
    from .universe import FUNNEL_STAGES

    idx = FUNNEL_STAGES.index(stage)
    return FUNNEL_STAGES[min(idx + 1, len(FUNNEL_STAGES) - 1)]


def build_all() -> tuple[list[Loan], list[Application], dict[str, dict[str, float]]]:
    rng = random.Random(SEED)
    loans = build_loans(rng)
    ta = build_ta(rng, loans)
    apps = build_applications(rng, loans)
    return loans, apps, ta
