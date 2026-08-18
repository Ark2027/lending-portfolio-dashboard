"""Build the demo dataset the dashboard loads.

    python tools/generate_demo_data.py

Writes src/data/dashboard.json, src/data/fee_reconciliation.json and
src/data/paid_search.json. The seed is fixed, so re-running produces a
byte-identical result and the committed data stays reviewable in a diff.

Nothing here reads any real source. The whole dataset is generated from the
distributions in tools/synth/universe.py.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.synth import crm, governance, history, impact, paid_search, programs  # noqa: E402
from tools.synth.ledger import build_all  # noqa: E402

OUT = ROOT / "src" / "data"
AS_OF = date(2026, 8, 17)


def main() -> int:
    loans, apps, ta = build_all()

    payload: dict = {
        "generated_at": f"{AS_OF.isoformat()}T06:30:00Z",
        "local_only": False,
        "privacy": {
            "contains_raw_borrower_pii": False,
            "detail": "This dataset is entirely synthetic. Partner organizations, business "
                      "names, states and every figure are generated from fixed "
                      "distributions and describe no real person or organization.",
        },
    }

    payload["impact"] = impact.build(loans, ta)
    payload.update(crm.build(apps, loans, ta))

    crm_by_partner = Counter(a.partner for a in apps if a.partner)
    program_blocks = programs.build(loans, ta, dict(crm_by_partner))
    matcher_records = program_blocks.pop("_matcher_records")
    payload.update(program_blocks)

    payload.update(governance.build(payload))
    payload["history"] = history.build(payload)

    OUT.mkdir(parents=True, exist_ok=True)
    _write(OUT / "dashboard.json", payload)
    _write(OUT / "fee_reconciliation.json", {
        "generated_at": payload["generated_at"],
        "total_matches": len(matcher_records["records"]),
        **matcher_records,
    })
    _write(OUT / "paid_search.json", paid_search.build())

    _report(payload, matcher_records)
    return 0


def _write(path: Path, data: dict) -> None:
    path.write_text(
        json.dumps(data, indent=1, sort_keys=False, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size / 1024:,.0f} KB")


def _report(payload: dict, bundle: dict) -> None:
    records = bundle["records"]
    t = payload["impact"]["totals"]
    r = payload["reporting_readiness"]
    tests = payload["data_tests"]
    failed = [x for x in tests if x["status"] == "fail"]

    print()
    print(f"  {t['originations']:,} originations   ${t['disbursed']:,.0f} disbursed   "
          f"{t['portfolio_loans']:,} on book")
    print(f"  {payload['rds']['exact_counts']['application']:,} CRM inquiries   "
          f"{len(records):,} reconciliation records")
    print(f"  {len(tests)} data tests, {len(failed)} failing "
          f"({sum(1 for x in failed if x['severity'] == 'blocking')} blocking)")
    print(f"  readiness: {r['status']}  board_ready={r['board_ready']}  "
          f"funder_ready={r['funder_ready']}")
    for x in failed:
        print(f"    [{x['severity']}] {x['name']}")


if __name__ == "__main__":
    raise SystemExit(main())
