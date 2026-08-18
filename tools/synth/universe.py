"""The fictional world the demo data is drawn from.

Everything here is invented. The partner organizations do not exist, the state
mix is chosen to make the map look interesting rather than to mirror anyone's
real footprint, and the numbers are generated from the distributions below.

The one thing that is deliberately *not* arbitrary is where the data is bad.
The quality page only has something to say if some partners under-report, so
the coverage gaps in PARTNERS are placed on purpose.
"""

from __future__ import annotations

from dataclasses import dataclass, field

SEED = 20260817

# Origination history runs five full years back from the reporting cutoff.
FIRST_MONTH = "2021-07"
LAST_MONTH = "2026-06"


@dataclass(frozen=True)
class Partner:
    """One fictional community lender."""

    name: str
    short: str
    states: tuple[str, ...]
    # Relative share of total origination volume.
    weight: float
    # Typical loan size and how widely it varies, in dollars.
    ticket_median: float
    ticket_spread: float
    # Portfolio quality knobs. Higher means worse.
    delinquency: float
    chargeoff: float
    # Technical assistance hours delivered per business served.
    ta_intensity: float
    # Businesses receiving advisory support per loan originated. Advisory
    # reaches far more businesses than lending does, which is why TA counts
    # dwarf loan counts and must not be read as a portfolio figure.
    ta_reach: float = 6.0
    # Which demographic fields this partner actually fills in. A field absent
    # from this set is *missing*, which is not the same as zero, and the
    # dashboard is supposed to say so.
    reports: frozenset[str] = field(default_factory=frozenset)
    # Fraction of rows left blank even for fields the partner does report.
    blank_rate: float = 0.0
    # Quarter this partner joined the reporting set, if not from the start.
    joined: str | None = None
    # Quarter a bulk historical backfill landed, if any.
    backfill: str | None = None


ALL_FIELDS = frozenset(
    {"race", "ethnicity", "gender", "income_band", "age_band", "veteran"}
)

PARTNERS: tuple[Partner, ...] = (
    Partner(
        name="Cardinal Community Capital",
        short="CCC",
        states=("TX", "NM", "OK", "AR"),
        weight=0.20,
        ticket_median=68_000,
        ticket_spread=0.85,
        delinquency=0.055,
        chargeoff=0.042,
        ta_intensity=3.4,
        ta_reach=7.2,
        reports=ALL_FIELDS,
        blank_rate=0.04,
    ),
    Partner(
        name="Harbor Point Fund",
        short="HPF",
        states=("NY", "NJ", "CT"),
        weight=0.16,
        ticket_median=104_000,
        ticket_spread=0.95,
        delinquency=0.048,
        chargeoff=0.038,
        ta_intensity=1.9,
        ta_reach=3.1,
        # No income band at all. This is the partner that proves "missing"
        # renders as missing rather than 0%.
        reports=ALL_FIELDS - {"income_band"},
        blank_rate=0.06,
    ),
    Partner(
        name="Ridgeline Development Finance",
        short="RDF",
        states=("CO", "UT", "WY", "MT"),
        weight=0.13,
        ticket_median=54_000,
        ticket_spread=0.72,
        delinquency=0.031,
        chargeoff=0.021,
        ta_intensity=2.6,
        ta_reach=5.4,
        reports=ALL_FIELDS,
        blank_rate=0.02,
    ),
    Partner(
        name="Northgate Community Lenders",
        short="NCL",
        states=("WA", "OR", "ID"),
        weight=0.11,
        ticket_median=74_000,
        ticket_spread=0.88,
        delinquency=0.062,
        chargeoff=0.055,
        ta_intensity=2.1,
        ta_reach=4.2,
        reports=ALL_FIELDS - {"veteran"},
        blank_rate=0.09,
    ),
    Partner(
        name="Blue Mesa Capital",
        short="BMC",
        states=("AZ", "NV", "NM"),
        weight=0.10,
        ticket_median=39_000,
        ticket_spread=0.65,
        delinquency=0.044,
        chargeoff=0.029,
        ta_intensity=4.8,
        ta_reach=9.1,
        reports=ALL_FIELDS,
        blank_rate=0.03,
    ),
    Partner(
        name="Trailhead Business Capital",
        short="TBC",
        states=("OH", "MI", "IN"),
        weight=0.09,
        ticket_median=33_000,
        ticket_spread=0.58,
        delinquency=0.071,
        chargeoff=0.048,
        ta_intensity=5.2,
        ta_reach=8.6,
        reports=ALL_FIELDS,
        # Reports every field but leaves a lot of them blank, which is a
        # different failure from not collecting the field at all.
        blank_rate=0.31,
    ),
    Partner(
        name="Silverbrook Fund",
        short="SBF",
        states=("WI", "MN", "IA"),
        weight=0.08,
        ticket_median=88_000,
        ticket_spread=0.79,
        delinquency=0.026,
        chargeoff=0.018,
        ta_intensity=3.9,
        ta_reach=6.3,
        reports=ALL_FIELDS - {"age_band"},
        blank_rate=0.05,
    ),
    Partner(
        name="Copperfield Community Finance",
        short="CCF",
        states=("GA", "FL", "AL", "SC"),
        weight=0.08,
        ticket_median=61_000,
        ticket_spread=0.81,
        delinquency=0.058,
        chargeoff=0.044,
        ta_intensity=2.8,
        ta_reach=5.8,
        reports=ALL_FIELDS,
        blank_rate=0.07,
        # Joined two years in, then backfilled its history a year later. This
        # is what makes one quarter look like growth when it is arrival.
        joined="2023-Q3",
        backfill="2024-Q3",
    ),
    Partner(
        name="Lakewind Economic Development",
        short="LED",
        states=("IL", "MO", "KS"),
        weight=0.05,
        ticket_median=46_000,
        ticket_spread=0.70,
        delinquency=0.039,
        chargeoff=0.026,
        ta_intensity=3.1,
        ta_reach=4.9,
        reports=ALL_FIELDS,
        blank_rate=0.11,
        joined="2024-Q4",
    ),
)

PARTNERS_BY_NAME = {p.name: p for p in PARTNERS}

# Rough population weights so the map has a believable center of gravity
# without matching any real distribution.
STATE_WEIGHTS: dict[str, float] = {
    "TX": 1.00, "NY": 0.78, "CA": 0.62, "FL": 0.58, "OH": 0.44,
    "IL": 0.41, "GA": 0.38, "WA": 0.36, "CO": 0.34, "AZ": 0.33,
    "NJ": 0.31, "MI": 0.29, "NM": 0.24, "MN": 0.23, "WI": 0.22,
    "OR": 0.21, "MO": 0.20, "IN": 0.19, "AL": 0.17, "SC": 0.17,
    "UT": 0.16, "OK": 0.15, "CT": 0.14, "NV": 0.14, "AR": 0.12,
    "IA": 0.12, "KS": 0.11, "ID": 0.09, "MT": 0.06, "WY": 0.04,
}

# Lending happens inside partner footprints, but inquiries arrive from
# everywhere, including places no partner covers. That gap between where demand
# shows up and where capital can actually be deployed is the point of the
# geography page, so the CRM draws from the whole country.
CRM_STATE_WEIGHTS: dict[str, float] = dict(STATE_WEIGHTS) | {
    "AK": 0.03, "DC": 0.07, "DE": 0.05, "HI": 0.06, "KY": 0.13,
    "LA": 0.14, "MA": 0.26, "MD": 0.22, "ME": 0.05, "MS": 0.09,
    "NC": 0.35, "ND": 0.03, "NE": 0.07, "NH": 0.05, "PA": 0.40,
    "RI": 0.04, "SD": 0.03, "TN": 0.23, "VA": 0.28, "VT": 0.03,
    "WV": 0.05,
}

# Demographic response options. Values are the labels the dashboard renders.
RACE_OPTIONS = (
    ("White", 0.41),
    ("African American", 0.22),
    ("Hispanic", 0.19),
    ("Asian", 0.11),
    ("Native American", 0.04),
    ("Other", 0.03),
)

GENDER_OPTIONS = (("Woman-owned", 0.44), ("Not woman-owned", 0.56))

INCOME_OPTIONS = (
    ("LMI", 0.47),
    ("Middle Income", 0.36),
    ("Upper Income", 0.17),
)

AGE_OPTIONS = (
    ("Young Adult (18-24)", 0.06),
    ("Adult (25-64)", 0.79),
    ("Senior (65+)", 0.15),
)

VETERAN_OPTIONS = (("Veteran", 0.13), ("Non-veteran", 0.87))

# Aging buckets, in days past due. The upper bound is exclusive, which is the
# off-by-one the original audit flagged; the labels here match the arithmetic.
AGING_BANDS: tuple[tuple[str, int, int], ...] = (
    ("Current", 0, 1),
    ("1-29 DPD", 1, 30),
    ("30-59 DPD", 30, 60),
    ("60-89 DPD", 60, 90),
    ("90+ DPD", 90, 10_000),
)

LOAN_SIZE_TIERS: tuple[tuple[str, float, float], ...] = (
    ("small_dollar", 0, 50_000),
    ("mid_market", 50_000, 250_000),
    ("large", 250_000, float("inf")),
)

# Applications enter here and either advance or drop out.
FUNNEL_STAGES: tuple[str, ...] = (
    "Pre-Screen Started",
    "Pre-Screen Complete",
    "Referred to Lender",
    "Application Submitted",
    "Underwriting",
    "Approved",
    "Closed / Funded",
)

# Per-stage pass-through rates. The product of these is the overall
# application-to-funded conversion.
STAGE_PASS_RATE: dict[str, float] = {
    "Pre-Screen Started": 0.71,
    "Pre-Screen Complete": 0.48,
    "Referred to Lender": 0.63,
    "Application Submitted": 0.74,
    "Underwriting": 0.66,
    "Approved": 0.88,
}
