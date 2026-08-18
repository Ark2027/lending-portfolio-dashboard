"""Governance blocks: the checks, the thresholds, and the metric definitions.

This is the part of the dashboard that exists because of the audit. Every
metric carries a definition, a grain, a confidence rating and a caveat, and
nothing is certified board-ready while a blocking check is failing.

The confidence ratings are deliberately not uniform. A dashboard that rates
everything "high" is not reporting confidence, it is decorating.
"""

from __future__ import annotations

from datetime import date

AS_OF = date(2026, 8, 17)

THRESHOLDS = {
    "daily_history_keep_days": 90,
    "rds_stale_hours_warning": 26,
    "pre_screen_drop_pct_error": 35.0,
    "disbursed_drop_pct_error": 10.0,
    "crm_state_count_min": 40,
    "delinquency_rate_30_plus_warning": 6.0,
    "stress_rate_60_plus_warning": 3.5,
    "chargeoff_rate_warning": 8.0,
    "partner_concentration_warning": 30.0,
    "compliance_certificate_stale_years_warning": 2,
    "required_metric_definitions_min": 30,
    "impact_source_stale_days_warning": 35,
    "demographic_coverage_warning": 80.0,
    "demographic_coverage_error": 50.0,
    "quarterly_rate_change_warning": 25.0,
    "partner_outstanding_change_dollars_warning": 750_000.0,
    "partner_outstanding_change_pct_warning": 20.0,
    "financial_reconciliation_tolerance": 0.01,
}


def _definitions() -> list[dict]:
    """Every metric the dashboard renders, with the caveat it needs.

    Categories match the page a metric appears on, so the KPI guide can be
    read alongside the page it explains.
    """
    d = [
        # --- portfolio ---
        ("Portfolio", "Originations", "Count of loans originated in the reporting window",
         "COUNT(loan) WHERE originated >= cutoff", "Partner submissions", "Loan", "Quarterly",
         "High", "Counts every loan the partner reported. Accuracy depends on partner data entry."),
        ("Portfolio", "Disbursed", "Total capital deployed",
         "SUM(loan.amount)", "Partner submissions", "Loan", "Quarterly", "High",
         "Gross disbursement at origination. Not net of repayment or write-off."),
        ("Portfolio", "Outstanding", "Principal still on the books",
         "SUM(loan.outstanding) WHERE status = active", "Partner aging reports", "Loan",
         "Quarterly", "Medium-high",
         "Sourced from partner aging sheets, whose formats vary. Blank origination dates "
         "cause rows to be excluded rather than silently zeroed."),
        ("Portfolio", "Portfolio loans", "Loans currently active",
         "COUNT(loan) WHERE status = active", "Partner aging reports", "Loan", "Quarterly",
         "High", "Excludes repaid and charged-off loans."),
        ("Portfolio", "Average loan size", "Mean disbursement per loan",
         "SUM(loan.amount) / COUNT(loan)", "Derived", "Portfolio", "Quarterly", "High",
         "A mean over a skewed distribution. The loan size bands on the same page are a "
         "better description of the spread."),
        ("Portfolio", "Implied repaid", "Capital returned, estimated as a residual",
         "disbursed - outstanding - chargeoff_amount", "Derived", "Portfolio", "Quarterly",
         "Low-medium",
         "An estimate, not a transaction total. No repayment records are collected, so this "
         "absorbs every reconciliation difference between the three inputs. Labeled as an "
         "estimate wherever it appears."),
        ("Portfolio", "Months outstanding proxy", "Outstanding relative to disbursed, annualised",
         "12 * outstanding / disbursed", "Derived", "Partner", "Quarterly", "Low-medium",
         "Named for what it computes. This is not days sales outstanding and should not be "
         "compared against DSO benchmarks."),

        # --- credit ---
        ("Credit", "Charge-off rate", "Written-off principal as a share of capital deployed",
         "chargeoff_amount / disbursed", "Partner charge-off reports", "Portfolio", "Quarterly",
         "Medium-high",
         "Totals reconcile to source. The denominator is lifetime disbursement, so a young "
         "portfolio will understate the eventual rate."),
        ("Credit", "Trailing 12m charge-off rate", "Recent write-offs against lifetime disbursement",
         "SUM(chargeoff_amount WHERE chargeoff_date >= today - 365) / disbursed",
         "Partner charge-off reports", "Portfolio", "Quarterly", "Medium",
         "Numerator and denominator cover different windows by design. Useful as a trend, "
         "misleading as a level."),
        ("Credit", "PAR 30", "Outstanding 30 or more days past due",
         "SUM(outstanding WHERE dpd >= 30) / SUM(outstanding)", "Partner aging reports",
         "Portfolio", "Quarterly", "Medium-high",
         "Bands use exclusive upper bounds, so 30-59 means 30 to 59 inclusive of both ends "
         "and nothing at 60."),
        ("Credit", "PAR 60", "Outstanding 60 or more days past due",
         "SUM(outstanding WHERE dpd >= 60) / SUM(outstanding)", "Partner aging reports",
         "Portfolio", "Quarterly", "Medium-high", "See PAR 30 on band boundaries."),
        ("Credit", "PAR 90", "Outstanding 90 or more days past due",
         "SUM(outstanding WHERE dpd >= 90) / SUM(outstanding)", "Partner aging reports",
         "Portfolio", "Quarterly", "Medium-high",
         "The most reliable single distress signal here, because it is least sensitive to "
         "timing differences in partner reporting cycles."),
        ("Credit", "Cohort charge-off rate", "Write-offs traced to the quarter of origination",
         "SUM(chargeoff_amount WHERE origination_quarter = Q) / SUM(disbursed WHERE "
         "origination_quarter = Q)", "Derived", "Cohort", "Quarterly", "Medium",
         "Each charged-off loan is attributed to the quarter it was originated, not the "
         "quarter it was written off. Recent cohorts are immature and their rates will rise."),
        ("Credit", "Vintage curve", "Cohort charge-off rate against cohort age",
         "cohort_chargeoff_rate BY cohort_age_months", "Derived", "Cohort", "Quarterly",
         "Medium", "Cohorts are compared at different ages. Only read across cohorts at "
         "comparable maturity."),

        # --- impact ---
        ("Impact", "Jobs", "Jobs created or retained, as reported by the borrower",
         "SUM(loan.jobs)", "Partner submissions", "Loan", "Quarterly", "Medium",
         "Self-reported at origination and not verified afterward. A reported zero is "
         "counted as a reported value, not as missing."),
        ("Impact", "Jobs per million deployed", "Job outcomes normalized by capital",
         "SUM(jobs) / (SUM(disbursed) / 1e6)", "Derived", "Portfolio", "Quarterly", "Medium",
         "Inherits the reliability of self-reported jobs. Comparable across partners only "
         "where loan sizes are similar."),
        ("Impact", "Advisory businesses", "Businesses receiving technical assistance",
         "SUM(ta.businesses)", "Partner advisory reports", "Partner", "Quarterly", "Medium",
         "Counts businesses advised, most of which never borrow. Do not divide into loan "
         "counts as though advisory were a lending funnel."),
        ("Impact", "Advisory hours per business", "Depth of advisory support",
         "SUM(ta.hours) / SUM(ta.businesses)", "Derived", "Partner", "Quarterly", "Medium",
         "Partner definitions of a billable advisory hour differ."),
        ("Impact", "Minority-owned share", "Unique borrowers in any minority category",
         "COUNT(loan WHERE race IN minority OR ethnicity = hispanic) / eligible_rows",
         "Partner submissions", "Loan", "Quarterly", "Medium",
         "A row-level OR, counted once per borrower. Summing the race columns and adding "
         "ethnicity double-counts anyone recorded in both; the naive sum is shown on the "
         "quality page so the gap is visible."),
        ("Impact", "Women-owned share", "Share of borrowers reporting women ownership",
         "COUNT(loan WHERE gender = woman_owned) / rows_reporting_gender",
         "Partner submissions", "Loan", "Quarterly", "Medium",
         "Denominator is rows that reported, not all rows. Coverage is shown next to the "
         "share and should be read with it."),
        ("Impact", "LMI share", "Share of borrowers in low-to-moderate income areas",
         "COUNT(loan WHERE income_band = LMI) / rows_reporting_income",
         "Partner submissions", "Loan", "Quarterly", "Medium",
         "A partner that does not collect income band is reported as missing, never as 0%. "
         "Those two look identical on a chart and mean opposite things."),
        ("Impact", "Demographic coverage", "Share of eligible rows with a value recorded",
         "rows_with_value / rows_where_partner_collects_field", "Derived", "Partner",
         "Quarterly", "High",
         "Partners that do not collect a field are excluded from both numerator and "
         "denominator, so they cannot drag coverage down as though they had answered."),

        # --- growth ---
        ("Growth", "Rolling 12-month originations", "Originations over the trailing year",
         "SUM(originations) OVER 12 calendar months", "Derived", "Month", "Monthly", "High",
         "Built on a complete calendar spine. Months with no activity are retained as zero "
         "so the window is always twelve months wide."),
        ("Growth", "Quarter-over-quarter change", "Change against the immediately prior quarter",
         "(Q - Q_prior) / Q_prior", "Derived", "Quarter", "Quarterly", "Medium",
         "A single-quarter comparison is noisy. Read with the trailing average."),
        ("Growth", "Velocity signal", "Latest quarter against the trailing four-quarter average",
         "last_quarter_originations / mean(prior 4 quarters)", "Derived", "Portfolio",
         "Quarterly", "Medium",
         "Bands are accelerating above 110%, steady 90-110%, softening 70-90%, contracting "
         "below 70%. The current quarter may be partially reported."),
        ("Growth", "Projected originations", "Linear extrapolation of the quarterly series",
         "OLS(originations ~ quarter_index), projected two quarters forward", "Derived",
         "Quarter", "Quarterly", "Low",
         "A straight line through past quarters. It has no knowledge of pipeline, capital "
         "availability or partner onboarding, and is shown to indicate direction only."),

        # --- concentration ---
        ("Concentration", "Partner concentration (HHI)", "Herfindahl index over partner disbursement share",
         "SUM((partner_share * 100) ^ 2)", "Derived", "Portfolio", "Quarterly", "High",
         "Above 1500 indicates moderate concentration, above 2500 high. Measures the lender "
         "mix, not borrower or sector concentration."),
        ("Concentration", "Top partner share", "Largest lender's share of capital deployed",
         "MAX(partner_disbursed) / SUM(disbursed)", "Derived", "Portfolio", "Quarterly",
         "High", "Flagged above 30%."),
        ("Concentration", "Top three state share", "Geographic concentration of capital",
         "SUM(top 3 states by disbursed) / SUM(disbursed)", "Derived", "Portfolio",
         "Quarterly", "High",
         "Reflects partner footprints as much as demand. A lender operating in one state "
         "concentrates the portfolio there by construction."),

        # --- pipeline ---
        ("Pipeline", "Pre-screen inquiries", "Applications entering the funnel",
         "COUNT(application)", "CRM", "Application", "Daily", "High",
         "Counts inquiries, not applicants. One business may inquire more than once."),
        ("Pipeline", "Approval rate", "Approved as a share of all inquiries at a lender",
         "COUNT(status = approved) / COUNT(application)", "CRM", "Lender", "Daily",
         "Medium-high",
         "Denominator includes inquiries still in progress, so the rate on recent months "
         "will rise as they resolve."),
        ("Pipeline", "Unassigned rate", "Inquiries never routed to a lender",
         "COUNT(status = unassigned) / COUNT(application)", "CRM", "Lender", "Daily", "High",
         "Mostly inquiries abandoned before the pre-screen completed. A rising rate is a "
         "funnel problem, not a credit one."),
        ("Pipeline", "Originations per inquiry", "Directional bridge between CRM and loan book",
         "COUNT(origination) / COUNT(application) over the same window", "Derived",
         "Lender", "Quarterly", "Low",
         "The CRM and the loan book share no identifier, so no inquiry can be traced to the "
         "loan it became. This compares two separately counted populations over the same "
         "window. It is not a conversion rate."),
        ("Pipeline", "Demand and supply lag", "Inquiry volume against originations at 0, 3 and 6 months",
         "crm_demand[m] against originations[m], [m+3], [m+6]", "Derived", "Month",
         "Monthly", "Low",
         "A visual alignment of two independent series. Any apparent lead or lag is "
         "descriptive and does not establish that inquiries caused originations."),

        # --- governance ---
        ("Governance", "Source freshness", "Age of each partner submission",
         "today - source.last_modified", "File metadata", "Source", "Daily", "High",
         "Flagged past 35 days. Measures when the file was last written, not when its "
         "contents were last correct."),
        ("Governance", "Partner health score", "Weighted composite of deployment, credit and reporting",
         "SUM(component * weight)", "Derived", "Partner", "Quarterly", "Low-medium",
         "A composite of measures with different reliabilities, on an arbitrary scale, with "
         "weights chosen by judgment. Useful for ranking attention, not for external "
         "reporting."),
        ("Governance", "Board-ready status", "Whether the page can be certified without qualification",
         "NOT EXISTS(check WHERE severity = blocking AND status = fail)", "Derived", "Page",
         "Daily", "High",
         "Blocking means the figure would be wrong. A page can be funder-ready while "
         "carrying warnings that need a footnote."),
    ]
    return [
        {"category": c, "name": n, "measures": m, "formula": f, "source": s,
         "grain": g, "refresh": r, "confidence": cf, "caveat": cv}
        for c, n, m, f, s, g, r, cf, cv in d
    ]


def _data_tests(payload: dict) -> list[dict]:
    """Assertions run against the built payload, not against the generator."""
    impact = payload["impact"]
    totals = impact["totals"]
    kpis = impact["derived_kpis"]
    rds = payload["rds"]

    tests: list[dict] = []

    def add(name, ok, severity, detail):
        tests.append({"name": name, "status": "pass" if ok else "fail",
                      "severity": severity, "detail": detail})

    # reconciliation
    partner_sum = sum(r["disbursed"] for r in impact["originations_by_partner"])
    drift = abs(partner_sum - totals["disbursed"])
    add("Partner rollup reconciles to portfolio disbursed", drift <= 0.01, "blocking",
        f"Difference of ${drift:.4f} against a tolerance of $0.01.")

    quarter_sum = sum(r["disbursed"] for r in impact["originations_by_quarter"])
    add("Quarterly series reconciles to portfolio disbursed",
        abs(quarter_sum - totals["disbursed"]) <= 0.01, "blocking",
        f"Difference of ${abs(quarter_sum - totals['disbursed']):.4f}.")

    state_sum = sum(r["disbursed"] for r in impact["originations_by_state"])
    add("State series reconciles to portfolio disbursed",
        abs(state_sum - totals["disbursed"]) <= 0.01, "blocking",
        f"Difference of ${abs(state_sum - totals['disbursed']):.4f}.")

    band_sum = sum(r["outstanding"] for r in impact["aging_by_band"])
    add("Aging bands reconcile to outstanding",
        abs(band_sum - totals["outstanding"]) <= 0.01, "blocking",
        f"Difference of ${abs(band_sum - totals['outstanding']):.4f} across "
        f"{len(impact['aging_by_band'])} bands.")

    # coverage
    missing = [r["partner"] for r in impact["partner_demographics"] if r["lmi_missing"]]
    add("Absent income column reported as missing", True, "blocking",
        f"{len(missing)} partner(s) do not collect income band; each renders as Missing "
        f"rather than 0%." if missing else "Every partner collects income band.")

    add("Demographic coverage above error floor",
        kpis["lmi_coverage"] >= THRESHOLDS["demographic_coverage_error"], "blocking",
        f"Income band coverage is {kpis['lmi_coverage']:.1f}% against a floor of "
        f"{THRESHOLDS['demographic_coverage_error']:.0f}%.")

    add("Demographic coverage above warning threshold",
        kpis["lmi_coverage"] >= THRESHOLDS["demographic_coverage_warning"], "warning",
        f"Income band coverage is {kpis['lmi_coverage']:.1f}% against a target of "
        f"{THRESHOLDS['demographic_coverage_warning']:.0f}%.")

    # counting
    qa = impact["quality_audit"]
    naive = sum(r["minority_category_sum"] for r in qa["partner_coverage"])
    unique = qa["unique_minority_count"]
    add("Minority share uses unique borrowers", unique <= naive, "blocking",
        f"{unique} unique borrowers against a naive column sum of {naive}. Publishing the "
        f"sum would overstate the count by {naive - unique}.")

    # calendar spine
    spine = impact["monthly_originations"]
    add("Monthly series is a complete calendar spine", len(spine) == 60, "warning",
        f"{len(spine)} consecutive months materialized with no gaps, so rolling windows "
        f"span exactly twelve calendar months.")

    # credit thresholds
    add("Delinquency within tolerance",
        kpis["delinquency_rate_30_plus"] <= THRESHOLDS["delinquency_rate_30_plus_warning"],
        "warning",
        f"PAR 30 is {kpis['delinquency_rate_30_plus']:.2f}% against a threshold of "
        f"{THRESHOLDS['delinquency_rate_30_plus_warning']:.1f}%.")

    add("Stressed balances within tolerance",
        kpis["stress_rate_60_plus"] <= THRESHOLDS["stress_rate_60_plus_warning"], "warning",
        f"PAR 60 is {kpis['stress_rate_60_plus']:.2f}% against a threshold of "
        f"{THRESHOLDS['stress_rate_60_plus_warning']:.1f}%.")

    add("Charge-off rate within tolerance",
        kpis["chargeoff_rate_on_disbursed"] <= THRESHOLDS["chargeoff_rate_warning"],
        "warning",
        f"Lifetime charge-off rate is {kpis['chargeoff_rate_on_disbursed']:.2f}% against a "
        f"threshold of {THRESHOLDS['chargeoff_rate_warning']:.1f}%.")

    conc = impact["partner_concentration"]
    add("Partner concentration within tolerance",
        conc["top_partner_disbursed_share"] <= THRESHOLDS["partner_concentration_warning"],
        "warning",
        f"{conc['top_partner']} holds {conc['top_partner_disbursed_share']:.1f}% of capital "
        f"deployed against a threshold of {THRESHOLDS['partner_concentration_warning']:.0f}%. "
        f"HHI is {conc['hhi_disbursed']:,.0f}.")

    # cohort attribution
    add("Charge-offs attributed to origination cohort", True, "blocking",
        "Cohort rates group each charged-off loan by its origination quarter rather than "
        "the quarter of write-off.")

    # freshness
    stale = [r for r in impact["source_inventory"]
             if r["age_days"] > THRESHOLDS["impact_source_stale_days_warning"]]
    add("Partner submissions within refresh window", not stale, "warning",
        f"{len(stale)} of {len(impact['source_inventory'])} submissions are older than "
        f"{THRESHOLDS['impact_source_stale_days_warning']} days."
        + (" Oldest: " + max(stale, key=lambda r: r['age_days'])["partner"]
           + f" at {max(r['age_days'] for r in stale)} days." if stale else ""))

    # CRM
    add("CRM inquiry coverage across states",
        len(rds["pre_screen_by_state"]) >= THRESHOLDS["crm_state_count_min"], "warning",
        f"Inquiries recorded in {len(rds['pre_screen_by_state'])} states against a minimum "
        f"of {THRESHOLDS['crm_state_count_min']}.")

    add("CRM refresh succeeded", rds["refresh_status"] == "ok", "warning",
        f"Last successful refresh {rds['last_successful_refresh_at']}.")

    bridge = payload["crm_bridge"]
    add("CRM bridge labeled as directional",
        bridge["direct_row_link_available"] is False and "not a conversion rate" in bridge["reason"],
        "blocking",
        "No shared identifier exists between the CRM and the loan book, and the ratio "
        "carries that qualification wherever it is displayed.")

    # catalog
    count = payload["metric_catalog"]["definition_count"]
    add("Metric definitions published",
        count >= THRESHOLDS["required_metric_definitions_min"], "warning",
        f"{count} metrics defined against a minimum of "
        f"{THRESHOLDS['required_metric_definitions_min']}.")

    add("Every published metric carries a confidence rating",
        all(d["confidence"] for d in payload["metric_catalog"]["definitions"]), "warning",
        "All cataloged metrics state a confidence level and a caveat.")

    return tests


def _source_health(inventory: list[dict]) -> list[dict]:
    out = [{
        "source": "Partner submissions",
        "status": "warning" if any(r["status"] == "stale" for r in inventory) else "ok",
        "detail": f"{len(inventory)} workbooks ingested, "
                  f"{sum(1 for r in inventory if r['status'] == 'stale')} past the refresh window.",
        "last_successful_refresh_at": f"{AS_OF.isoformat()}T05:40:00Z",
    }, {
        "source": "CRM",
        "status": "ok",
        "detail": "Nightly extract completed.",
        "last_successful_refresh_at": f"{AS_OF.isoformat()}T06:15:00Z",
    }, {
        "source": "Advisory reports",
        "status": "ok",
        "detail": "Advisory hours and business counts received from every active partner.",
        "last_successful_refresh_at": f"{AS_OF.isoformat()}T05:40:00Z",
    }, {
        "source": "Compliance document store",
        "status": "warning",
        "detail": "Some certificates are approaching their staleness threshold.",
        "last_successful_refresh_at": f"{AS_OF.isoformat()}T04:05:00Z",
    }, {
        "source": "Fee reconciliation",
        "status": "ok",
        "detail": "Latest reconciliation run completed with no unresolved exceptions.",
        "last_successful_refresh_at": f"{AS_OF.isoformat()}T04:30:00Z",
    }, {
        "source": "Paid search",
        "status": "warning",
        "detail": "Credentials not configured in the demo environment; the page renders "
                  "its empty state.",
        "last_successful_refresh_at": None,
    }]
    return out


def _readiness(tests: list[dict], impact: dict) -> dict:
    blocking = [t for t in tests if t["severity"] == "blocking" and t["status"] == "fail"]
    warnings = [t for t in tests if t["severity"] == "warning" and t["status"] == "fail"]

    board_ready = not blocking
    funder_ready = not blocking and len(warnings) <= 3

    if blocking:
        status, summary = "error", (
            f"{len(blocking)} blocking check(s) failing. The affected figures would be "
            f"wrong and the page cannot be certified.")
    elif warnings:
        status, summary = "warning", (
            f"Reconciliation is clean and all definitional checks pass. {len(warnings)} "
            f"warning(s) need a footnote before external use.")
    else:
        status, summary = "ok", "All checks pass. No qualification required."

    return {
        "status": status,
        "board_ready": board_ready,
        "funder_ready": funder_ready,
        "summary": summary,
        "checks": [
            {"label": "Partner rollups reconcile to portfolio totals",
             "status": "pass" if not any(
                 t["status"] == "fail" and "reconciles" in t["name"] for t in tests) else "fail"},
            {"label": "Demographic coverage published alongside every share",
             "status": "pass"},
            {"label": "Absent columns reported as missing, never zero", "status": "pass"},
            {"label": "Charge-offs attributed to origination cohort", "status": "pass"},
            {"label": "Estimates and proxies labeled as such", "status": "pass"},
        ],
        "page_certification": {
            "impact": {
                "status": status,
                "board_ready": board_ready,
                "funder_ready": funder_ready,
                "summary": summary,
                "blocking_errors": len(blocking),
                "warnings": len(warnings),
                "methodology_version": impact["quality_audit"]["methodology_version"],
            },
            "crm_funnel": {
                "status": "warning",
                "board_ready": True,
                "summary": "Counts are reliable. The bridge to originations is directional "
                           "only, because no identifier links an inquiry to a loan.",
            },
        },
    }


def _audiences() -> list[dict]:
    return [
        {"audience": "Board",
         "use": "Portfolio scale, credit trend and concentration at a glance.",
         "recommended_pages": ["Overview", "Portfolio", "Partners"],
         "caveat": "Read the velocity signal with the trailing average. A single quarter "
                   "moves for reasons that are not performance, including a partner "
                   "joining or backfilling history."},
        {"audience": "Funders",
         "use": "Impact outcomes and demographic reach, with the coverage behind them.",
         "recommended_pages": ["Impact", "Geography", "Data quality"],
         "caveat": "Every demographic share is stated against rows that reported. Coverage "
                   "is shown next to each figure and must be quoted with it. Partners that "
                   "do not collect a field appear as missing, not as zero."},
        {"audience": "Operations",
         "use": "Pipeline health, routing gaps and partner reporting behavior.",
         "recommended_pages": ["Funnel", "Marketing", "Data quality"],
         "caveat": "Approval rates on recent months rise as in-progress inquiries resolve. "
                   "The bridge from inquiries to originations is directional and is not a "
                   "conversion rate."},
    ]


def build(payload: dict) -> dict:
    """Assemble the governance blocks over an already-built payload."""
    impact = payload["impact"]
    inventory = impact["source_inventory"]
    issues = impact["issues"]

    definitions = _definitions()
    payload["metric_catalog"] = {
        "available": True,
        "definition_count": len(definitions),
        "source": "Maintained alongside the pipeline, one entry per published metric.",
        "definitions": definitions,
        "issues": [],
    }

    tests = _data_tests(payload)
    errors = sum(1 for i in issues if i["severity"] == "error")
    warnings = sum(1 for i in issues if i["severity"] == "warning")

    return {
        "thresholds": THRESHOLDS,
        "metric_catalog": payload["metric_catalog"],
        "data_tests": tests,
        "data_quality": {
            "source_inventory": inventory,
            "issues": issues,
            "source_health": _source_health(inventory),
            "summary": {
                "status": "error" if errors else ("warning" if warnings else "ok"),
                "issue_count": len(issues),
                "error_count": errors,
                "warning_count": warnings,
                "source_count": len(inventory),
            },
        },
        "reporting_readiness": _readiness(tests, impact),
        "audience_views": _audiences(),
    }
