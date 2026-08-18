"""Checks on the generated dataset.

Two kinds of test live here. The first kind asserts the dataset is internally
consistent: partner splits add up to portfolio totals, aging bands add up to
outstanding, coverage denominators exclude partners who never collected the
field. Those are the same properties the dashboard's own data-quality page
claims, so if they break the page would be lying.

The second kind asserts the published files carry nothing that identifies a
real organization. That one exists because a demo dataset is only useful if
it is unmistakably a demo.

    python tests/test_dataset.py
"""

from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.synth import crm, governance, history, impact, paid_search, programs  # noqa: E402
from tools.synth.ledger import build_all, month_range, quarter_of  # noqa: E402
from tools.synth.universe import PARTNERS, PARTNERS_BY_NAME  # noqa: E402

SRC = ROOT / "src"
DATA = SRC / "data"
CENT = 0.011


def _payload() -> dict:
    return json.loads((DATA / "dashboard.json").read_text(encoding="utf-8"))


class LedgerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loans, cls.apps, cls.ta = build_all()

    def test_generation_is_deterministic(self):
        """A fixed seed has to produce a byte-identical dataset.

        Without this the committed JSON churns on every run and stops being
        reviewable in a diff.
        """
        again_loans, again_apps, again_ta = build_all()
        self.assertEqual(len(self.loans), len(again_loans))
        self.assertEqual(
            [l.loan_id for l in self.loans[:50]],
            [l.loan_id for l in again_loans[:50]],
        )
        self.assertEqual(
            [round(l.amount, 2) for l in self.loans[:50]],
            [round(l.amount, 2) for l in again_loans[:50]],
        )
        self.assertEqual(self.ta, again_ta)
        self.assertEqual(len(self.apps), len(again_apps))

    def test_every_loan_has_a_known_partner_and_footprint_state(self):
        for loan in self.loans:
            partner = PARTNERS_BY_NAME[loan.partner]
            self.assertIn(loan.state, partner.states,
                          f"{loan.loan_id} booked outside its lender's footprint")

    def test_loan_status_and_balances_agree(self):
        for loan in self.loans:
            if loan.status == "active":
                self.assertGreater(loan.outstanding, 0)
                self.assertEqual(loan.chargeoff_amount, 0.0)
            elif loan.status == "repaid":
                self.assertEqual(loan.outstanding, 0.0)
                self.assertEqual(loan.chargeoff_amount, 0.0)
            else:
                self.assertEqual(loan.outstanding, 0.0)
                self.assertGreater(loan.chargeoff_amount, 0.0)
                self.assertIsNotNone(loan.chargeoff_date)

    def test_a_partner_never_reports_a_field_it_does_not_collect(self):
        for loan in self.loans:
            partner = PARTNERS_BY_NAME[loan.partner]
            for field, value in loan.demographics.items():
                if field not in partner.reports:
                    self.assertIsNone(
                        value, f"{partner.name} returned {field} it does not collect")

    def test_partners_contribute_nothing_before_they_join(self):
        for loan in self.loans:
            partner = PARTNERS_BY_NAME[loan.partner]
            if partner.joined:
                self.assertGreaterEqual(
                    quarter_of(loan.originated).replace("-", ""),
                    partner.joined.replace("-", ""),
                    f"{partner.name} has a loan before it joined")

    def test_applications_route_only_after_pre_screen_completes(self):
        for app in self.apps:
            if app.stage == "Pre-Screen Started":
                self.assertIsNone(app.partner)
            else:
                self.assertIsNotNone(app.partner)


class ImpactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        loans, apps, ta = build_all()
        cls.loans = loans
        cls.block = impact.build(loans, ta)

    def test_partner_rollup_reconciles_to_portfolio(self):
        total = self.block["totals"]["disbursed"]
        rollup = sum(r["disbursed"] for r in self.block["originations_by_partner"])
        self.assertAlmostEqual(rollup, total, delta=CENT)

    def test_quarter_and_state_series_reconcile_to_portfolio(self):
        total = self.block["totals"]["disbursed"]
        for key in ("originations_by_quarter", "originations_by_state"):
            rollup = sum(r["disbursed"] for r in self.block[key])
            self.assertAlmostEqual(rollup, total, delta=CENT, msg=key)

    def test_aging_bands_reconcile_to_outstanding(self):
        total = self.block["totals"]["outstanding"]
        rollup = sum(r["outstanding"] for r in self.block["aging_by_band"])
        self.assertAlmostEqual(rollup, total, delta=CENT)

    def test_monthly_series_is_a_complete_calendar_spine(self):
        """Every month has a row, including months with no originations.

        Dropping empty months is what allowed a twelve-row rolling window to
        span more than twelve calendar months in the pipeline this models.
        """
        months = [r["month"] for r in self.block["monthly_originations"]]
        self.assertEqual(months, month_range(months[0], months[-1]))
        self.assertEqual(len(months), 60)

    def test_unique_minority_never_exceeds_the_naive_column_sum(self):
        qa = self.block["quality_audit"]
        naive = sum(r["minority_category_sum"] for r in qa["partner_coverage"])
        self.assertLessEqual(qa["unique_minority_count"], naive)
        self.assertGreater(naive, qa["unique_minority_count"],
                           "fixture should contain at least one double-counted borrower")

    def test_absent_income_column_is_missing_not_zero(self):
        missing = [r for r in self.block["partner_demographics"] if r["lmi_missing"]]
        self.assertTrue(missing, "fixture should include a partner with no income data")
        for row in missing:
            self.assertIsNone(row["lmi"])
            self.assertIsNone(row["lmi_coverage"])
            self.assertEqual(row["lmi_reported_count"], 0)

    def test_coverage_denominator_excludes_partners_who_do_not_collect(self):
        """A partner that never collected a field cannot drag coverage down."""
        collecting = [p.name for p in PARTNERS if "income_band" in p.reports]
        eligible = sum(1 for l in self.loans if l.partner in collecting)
        reported = sum(r["lmi_reported"] for r in self.block["partner_demographics"])
        self.assertLessEqual(reported, eligible)
        self.assertEqual(self.block["derived_kpis"]["lmi_coverage"],
                         round(100.0 * reported / len(self.loans), 2))

    def test_cohort_chargeoffs_are_attributed_to_origination_quarter(self):
        by_quarter = {r["quarter"]: r for r in self.block["cohort_performance"]}
        for loan in self.loans:
            if loan.status != "chargeoff":
                continue
            cohort = by_quarter[quarter_of(loan.originated)]
            self.assertGreater(cohort["chargeoffs"], 0)

    def test_capital_recycling_is_labeled_an_estimate(self):
        recycling = self.block["capital_recycling"]
        self.assertTrue(recycling["is_estimate"])
        self.assertAlmostEqual(
            recycling["implied_repaid"],
            recycling["total_disbursed"] - recycling["outstanding"] - recycling["chargeoff_amount"],
            delta=CENT)

    def test_credit_ratios_stay_in_a_believable_range(self):
        kpis = self.block["derived_kpis"]
        self.assertTrue(0.5 <= kpis["chargeoff_rate_on_disbursed"] <= 12.0)
        self.assertTrue(0.0 <= kpis["par_90"] <= kpis["par_60"] <= kpis["par_30"] <= 20.0)
        self.assertTrue(20_000 <= kpis["average_loan_size"] <= 250_000)


class CrmTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        loans, apps, ta = build_all()
        cls.block = crm.build(apps, loans, ta)

    def test_funnel_counts_never_increase_down_the_stages(self):
        totals: dict[str, int] = {}
        for row in cls_stage(self.block):
            totals[row["stage"]] = totals.get(row["stage"], 0) + row["count"]
        counts = list(totals.values())
        for earlier, later in zip(counts, counts[1:]):
            self.assertLessEqual(later, earlier, f"funnel rises at {totals}")

    def test_bridge_refuses_to_call_itself_a_conversion_rate(self):
        bridge = self.block["crm_bridge"]
        self.assertFalse(bridge["direct_row_link_available"])
        self.assertIn("not a conversion rate", bridge["reason"])

    def test_inquiries_cover_more_states_than_lending_does(self):
        """Demand arrives from places no lender covers. That gap is the point
        of the geography page, so it has to survive into the data."""
        crm_states = {r["state"] for r in self.block["rds"]["pre_screen_by_state"]}
        footprint = {s for p in PARTNERS for s in p.states}
        self.assertGreater(len(crm_states), len(footprint))


def cls_stage(block):
    return block["rds"]["stage_status"]


class PublishedFileTests(unittest.TestCase):
    """The files that actually ship."""

    SECRETS = (
        r"AKIA[0-9A-Z]{16}",                 # AWS access key
        r"sk-ant-[A-Za-z0-9_-]{20,}",        # Anthropic key
        r"ya29\.[A-Za-z0-9_-]{20,}",         # Google OAuth token
        r"-----BEGIN [A-Z ]*PRIVATE KEY",    # private key block
        r"\bpassword\s*[:=]\s*[\"'][^\"']+", # assigned password literal
    )

    @classmethod
    def setUpClass(cls):
        cls.files = sorted(
            p for p in SRC.rglob("*")
            if p.is_file() and p.suffix in {".js", ".html", ".css", ".json", ".svg"}
        )

    def test_shipped_files_exist(self):
        names = {p.name for p in self.files}
        for required in ("index.html", "app.js", "styles.css", "dashboard.json",
                         "fee_reconciliation.json", "paid_search.json"):
            self.assertIn(required, names)

    def test_every_named_organization_is_one_of_the_fictional_lenders(self):
        """An allowlist, not a blocklist.

        Checking that a list of real organizations is absent would mean
        committing that list, which is the thing being avoided. Asserting the
        opposite is both safer and stricter: every organization named anywhere
        in the shipped data has to be one of the nine invented lenders.
        """
        allowed = {p.name for p in PARTNERS}
        allowed_codes = {p.short for p in PARTNERS}
        name_fields = ("partner", "cdfi", "org_name", "top_partner")
        code_fields = ("lender_code", "crm_cdfi_code")

        seen_names: set[str] = set()
        seen_codes: set[str] = set()

        def walk(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in name_fields and isinstance(value, str):
                        seen_names.add(value)
                    if key in code_fields and isinstance(value, str):
                        seen_codes.add(value)
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        for name in ("dashboard.json", "fee_reconciliation.json", "paid_search.json"):
            walk(json.loads((DATA / name).read_text(encoding="utf-8")))

        # State codes ride along in a couple of these fields; drop anything short.
        stray_names = {n for n in seen_names if len(n) > 3 and n not in allowed
                       and n not in {"Unassigned", "Community Lending Network"}}
        self.assertEqual(stray_names, set(), f"unexpected organization names: {stray_names}")

        stray_codes = {c for c in seen_codes
                       if c not in allowed_codes and c.lower() not in {p.short.lower() for p in PARTNERS}}
        self.assertEqual(stray_codes, set(), f"unexpected lender codes: {stray_codes}")

    def test_partner_names_in_the_markup_are_fictional(self):
        """The front end hardcodes an abbreviation map. It has to stay in sync."""
        app = (SRC / "app.js").read_text(encoding="utf-8")
        start = app.index("const shortName")
        block = app[start:start + 900]
        # Keys only — the values are the abbreviations they map to.
        for quoted in re.findall(r'"([^"]+)"\s*:', block):
            self.assertIn(quoted, {p.name for p in PARTNERS},
                          f"{quoted!r} in the abbreviation map is not a fictional lender")

    def test_no_credentials(self):
        pattern = re.compile("|".join(self.SECRETS))
        for path in self.files:
            text = path.read_text(encoding="utf-8", errors="replace")
            self.assertIsNone(pattern.search(text),
                              f"{path.relative_to(ROOT)} looks like it contains a secret")

    def test_no_absolute_or_external_data_paths(self):
        """Paths must be relative so the site works from a project subpath.

        GitHub Pages serves this from /lending-portfolio-dashboard/, so a
        leading slash resolves to the wrong origin root and 404s.
        """
        app = (SRC / "app.js").read_text(encoding="utf-8")
        self.assertNotIn('fetch("/', app)
        self.assertNotIn("/api/", app)

        html = (SRC / "index.html").read_text(encoding="utf-8")
        absolute = re.findall(r'(?:href|src)="(/[^"/][^"]*)"', html)
        self.assertEqual(absolute, [], f"absolute paths in index.html: {absolute}")

    def test_payload_declares_itself_synthetic(self):
        privacy = _payload()["privacy"]
        self.assertFalse(privacy["contains_raw_borrower_pii"])
        self.assertIn("synthetic", privacy["detail"].lower())

    def test_index_carries_the_demonstration_notice(self):
        html = (SRC / "index.html").read_text(encoding="utf-8")
        self.assertIn("demo-banner", html)
        self.assertIn("synthetic", html)

    def test_payload_has_every_block_the_pages_read(self):
        payload = _payload()
        for key in ("impact", "rds", "matcher", "compliance", "quarterly_compliance",
                    "google_ads", "metric_catalog", "thresholds", "data_quality",
                    "history", "partner_health", "crm_bridge", "crm_funnel_rates",
                    "monthly_pre_screen_volume", "data_tests", "reporting_readiness",
                    "audience_views", "demand_supply_lag"):
            self.assertIn(key, payload)

    def test_published_totals_match_a_fresh_generation(self):
        """The committed JSON must be what the generator currently produces."""
        loans, apps, ta = build_all()
        fresh = impact.build(loans, ta)["totals"]
        published = _payload()["impact"]["totals"]
        self.assertEqual(published, fresh,
                         "src/data is stale — re-run tools/generate_demo_data.py")

    def test_no_blocking_check_is_failing(self):
        payload = _payload()
        blocking = [t for t in payload["data_tests"]
                    if t["severity"] == "blocking" and t["status"] == "fail"]
        self.assertEqual(blocking, [], "a blocking data test is failing")
        self.assertTrue(payload["reporting_readiness"]["board_ready"])

    def test_every_cataloged_metric_states_confidence_and_caveat(self):
        for entry in _payload()["metric_catalog"]["definitions"]:
            self.assertTrue(entry["confidence"], entry["name"])
            self.assertTrue(entry["caveat"], entry["name"])


class ReconciliationRecordTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = json.loads(
            (DATA / "fee_reconciliation.json").read_text(encoding="utf-8"))

    def test_review_notes_agree_with_the_decision(self):
        for row in self.bundle["records"]:
            if row["status"] == "rejected":
                self.assertNotIn("accept", row["status_note"].lower(),
                                 f"{row['match_key']} rejected with an accepting note")

    def test_only_billed_rows_carry_billing_detail(self):
        for row in self.bundle["records"]:
            if row["status"] == "billed":
                self.assertIsNotNone(row["billed_amount"])
                self.assertIsNotNone(row["invoice_date"])
            else:
                self.assertIsNone(row["billed_amount"])
                self.assertIsNone(row["invoice_date"])

    def test_fee_follows_the_published_schedule(self):
        for row in self.bundle["records"]:
            amount = row["primary_origination_amount"]
            if amount <= 250_000:
                self.assertAlmostEqual(row["fee_amount"], min(amount * 0.025, 2500), delta=CENT)
            elif amount <= 500_000:
                self.assertEqual(row["fee_amount"], 3000.0)
            else:
                self.assertEqual(row["fee_amount"], 5000.0)

    def test_the_lead_predates_the_origination_it_is_credited_with(self):
        for row in self.bundle["records"]:
            self.assertLess(row["lead_start_date"], row["primary_origination_date"],
                            f"{row['match_key']} claims a lead after the loan closed")

    def test_some_names_differ_between_the_two_systems(self):
        """If every name matched exactly there would be nothing to reconcile."""
        differing = sum(1 for r in self.bundle["records"]
                        if r["live_business_name"] != r["crm_business_name"])
        self.assertGreater(differing, 50)


if __name__ == "__main__":
    unittest.main(verbosity=2)
