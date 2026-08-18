"""Synthetic paid-search performance for the marketing page.

The original front end carried a hardcoded snapshot of a live advertising
account. This replaces it with generated figures over the same shape.

Competitor domains are invented rather than borrowed from real companies:
attaching fabricated impression-share numbers to a real business name would be
a claim about that business, which is not something a demo dataset should make.
"""

from __future__ import annotations

import random
from datetime import date

from .universe import PARTNERS, SEED

AS_OF = date(2026, 8, 17)
DEMO_DOMAIN = "lendingnetwork.example"

# Campaigns run in a handful of metros, not across every partner footprint.
MARKETS = (
    ("Travis County, TX", "TX", "Cardinal Community Capital"),
    ("Kings County, NY", "NY", "Harbor Point Fund"),
    ("Denver County, CO", "CO", "Ridgeline Development Finance"),
    ("King County, WA", "WA", "Northgate Community Lenders"),
    ("Maricopa County, AZ", "AZ", "Blue Mesa Capital"),
    ("Cuyahoga County, OH", "OH", "Trailhead Business Capital"),
    ("Milwaukee County, WI", "WI", "Silverbrook Fund"),
    ("Fulton County, GA", "GA", "Copperfield Community Finance"),
)

KEYWORDS = (
    "small business loan",
    "cdfi business loan",
    "startup business funding",
    "microloan for small business",
    "business loan bad credit",
    "minority business loan",
    "women owned business loan",
    "business loan no collateral",
)

SEARCH_TERMS = (
    "small business loan near me",
    "how to get a business loan",
    "community lender small business",
    "business grants for startups",
    "microloan lenders",
    "business loan without collateral",
    "first time business loan",
    "nonprofit business lender",
)

COMPETITORS = (
    "capitalbridge.example",
    "mainstreetfunding.example",
    "quickbizloans.example",
    "fundingcompare.example",
    "smallbizadvisor.example",
    "lenderdirectory.example",
    "growthcapital.example",
)

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
HOURS = ("7 AM - 8 AM", "9 AM - 10 AM", "10 AM - 11 AM", "11 AM - 12 PM",
         "1 PM - 2 PM", "3 PM - 4 PM", "6 PM - 7 PM")
DEVICES = ("Mobile phones", "Computers", "Tablets")


def _r2(x: float) -> float:
    return round(x + 0.0, 2)


def _r4(x: float) -> float:
    return round(x + 0.0, 4)


def _campaign_name(market: str, partner: str) -> str:
    short = next(p.short for p in PARTNERS if p.name == partner)
    return f"{short} - {market}"


def build() -> dict:
    rng = random.Random(SEED + 53)

    active = list(MARKETS[:3])
    paused = list(MARKETS[3:])

    campaigns = []
    locations = []
    for market, state, partner in active:
        name = _campaign_name(market, partner)
        impressions = rng.randint(280, 620)
        clicks = rng.randint(int(impressions * 0.10), int(impressions * 0.19))
        cost = _r2(clicks * rng.uniform(9.5, 17.0))
        conversions = rng.randint(int(clicks * 0.18), int(clicks * 0.46))
        campaigns.append({
            "campaign": name,
            "adGroup": f"{market} - core terms",
            "partner": partner,
            "market": market,
            "state": state,
            "status": "Eligible",
            "budget": 33,
            "optimizationScore": _r4(rng.uniform(0.52, 0.58)),
            "impressions": impressions,
            "clicks": clicks,
            "ctr": _r4(clicks / impressions),
            "cost": cost,
            "conversionRate": _r4(conversions / clicks) if clicks else 0.0,
            "conversions": conversions,
            "costPerConversion": _r2(cost / conversions) if conversions else 0.0,
            "bidStrategy": "Maximize conversions",
        })
        locations.append({
            "location": market,
            "campaign": name,
            "partner": partner,
            "state": state,
            "impressions": impressions,
            "clicks": clicks,
            "ctr": _r4(clicks / impressions),
            "avgCpc": _r2(cost / clicks) if clicks else 0.0,
            "cost": cost,
            "conversionRate": _r4(conversions / clicks) if clicks else 0.0,
            "conversions": conversions,
            "costPerConversion": _r2(cost / conversions) if conversions else 0.0,
        })

    total_impr = sum(c["impressions"] for c in campaigns)
    total_clicks = sum(c["clicks"] for c in campaigns)
    total_cost = _r2(sum(c["cost"] for c in campaigns))
    total_conv = sum(c["conversions"] for c in campaigns)

    keywords = []
    for kw in KEYWORDS:
        camp = rng.choice(campaigns)["campaign"]
        impressions = rng.randint(35, 240)
        clicks = rng.randint(4, max(5, int(impressions * 0.16)))
        cost = _r2(clicks * rng.uniform(9.0, 18.0))
        conv = rng.randint(0, max(1, int(clicks * 0.7)))
        keywords.append({
            "keyword": f'"{kw}"', "campaign": camp, "impressions": impressions,
            "clicks": clicks, "cost": cost, "conversions": conv,
            "costPerConversion": _r2(cost / conv) if conv else 0.0,
            "conversionRate": _r4(conv / clicks) if clicks else 0.0,
        })

    search_terms = []
    for term in SEARCH_TERMS:
        camp = rng.choice(campaigns)["campaign"]
        clicks = rng.randint(2, 12)
        impressions = clicks * rng.randint(3, 6)
        cost = _r2(clicks * rng.uniform(10.0, 16.0))
        conv = rng.randint(0, 3)
        search_terms.append({
            "term": term, "campaign": camp, "clicks": clicks,
            "impressions": impressions, "cost": cost, "conversions": conv,
            "costPerConversion": _r2(cost / conv) if conv else 0.0,
        })

    devices = []
    for device in DEVICES:
        share = {"Mobile phones": 0.58, "Computers": 0.38, "Tablets": 0.04}[device]
        for camp in campaigns:
            clicks = max(1, int(camp["clicks"] * share * rng.uniform(0.85, 1.15)))
            impressions = max(clicks, int(camp["impressions"] * share))
            cost = _r2(clicks * rng.uniform(9.0, 20.0))
            conv = rng.randint(0, max(1, int(clicks * 0.5)))
            devices.append({
                "device": device, "campaign": camp["campaign"],
                "partner": camp["partner"], "clicks": clicks,
                "impressions": impressions, "ctr": _r4(clicks / impressions),
                "avgCpc": _r2(cost / clicks), "cost": cost,
                "conversionRate": _r4(conv / clicks), "conversions": conv,
                "costPerConversion": _r2(cost / conv) if conv else 0.0,
            })

    dayparts = []
    for _ in range(10):
        camp = rng.choice(campaigns)
        clicks = rng.randint(2, 5)
        impressions = clicks * rng.randint(2, 6)
        cost = _r2(clicks * rng.uniform(7.0, 20.0))
        conv = rng.randint(0, 3)
        dayparts.append({
            "day": rng.choice(DAYS), "hour": rng.choice(HOURS),
            "campaign": camp["campaign"], "clicks": clicks,
            "impressions": impressions, "ctr": _r4(clicks / impressions),
            "avgCpc": _r2(cost / clicks), "cost": cost,
            "conversionRate": _r4(conv / clicks), "conversions": conv,
            "costPerConversion": _r2(cost / conv) if conv else 0.0,
        })
    dayparts.sort(key=lambda r: -r["clicks"])

    landing = []
    for label, path, weight in (
        ("Primary campaign landing page", "/apply", 0.94),
        ("Application start", "/apply/start", 0.03),
        ("How it works", "/how-it-works", 0.01),
        ("Find a lender", "/lenders", 0.01),
        ("Education", "/learn", 0.0),
    ):
        clicks = int(total_clicks * weight)
        cost = _r2(clicks * rng.uniform(11.0, 16.0))
        landing.append({
            "page": label, "url": f"{DEMO_DOMAIN}{path}",
            "selectedBy": "Advertiser selected", "clicks": clicks,
            "impressions": total_impr if weight > 0.5 else rng.randint(400, 950),
            "ctr": _r4(clicks / total_impr) if total_impr else 0.0,
            "avgCpc": _r2(cost / clicks) if clicks else 0.0, "cost": cost,
        })

    auction = [{
        "domain": "You", "impressionShare": _r4(rng.uniform(0.72, 0.82)),
        "overlapRate": None, "positionAboveRate": None,
        "topOfPageRate": _r4(rng.uniform(0.85, 0.94)),
        "absoluteTopOfPageRate": _r4(rng.uniform(0.78, 0.86)),
        "outrankingShare": None,
    }]
    for i, domain in enumerate(COMPETITORS):
        low = i >= 4
        auction.append({
            "domain": domain,
            "impressionShare": None if low else _r4(rng.uniform(0.11, 0.18)),
            "impressionShareLabel": "< 10%" if low else None,
            "overlapRate": _r4(rng.uniform(0.06, 0.19)),
            "positionAboveRate": _r4(rng.uniform(0.03, 0.14)),
            "topOfPageRate": _r4(rng.uniform(0.62, 0.84)),
            "absoluteTopOfPageRate": _r4(rng.uniform(0.04, 0.20)),
            "outrankingShare": _r4(rng.uniform(0.76, 0.79)),
        })

    biggest = []
    for market, state, partner in list(active) + paused[:3]:
        name = _campaign_name(market, partner)
        is_paused = (market, state, partner) in paused
        delta = _r2(-rng.uniform(220, 380) if is_paused else rng.uniform(180, 390))
        biggest.append({
            "campaign": name, "costDelta": delta,
            "percentDelta": -1 if is_paused else _r4(rng.uniform(0.28, 0.64)),
            "status": "Paused / spend stopped" if is_paused else "Active spend up",
        })
    biggest.sort(key=lambda r: -abs(r["costDelta"]))

    return {
        "source": "Generated demo dataset",
        "data_available": True,
        "refresh_status": "sample",
        "sample": True,
        "dateRange": "Jul 18 - Aug 16, 2026",
        "timezone": "Central Time",
        "account": {"name": "Community Lending Network"},
        "totals": {
            "impressions": total_impr,
            "clicks": total_clicks,
            "interactions": total_clicks,
            "cost": total_cost,
            "conversions": total_conv,
            "conversionRate": _r4(total_conv / total_clicks) if total_clicks else 0.0,
            "ctr": _r4(total_clicks / total_impr) if total_impr else 0.0,
            "avgCpc": _r2(total_cost / total_clicks) if total_clicks else 0.0,
            "costPerConversion": _r2(total_cost / total_conv) if total_conv else 0.0,
            "enabledCampaignsInWindow": len(campaigns),
            "visibleCampaigns": len(MARKETS) * 3,
        },
        "searchTermsTotal": {
            "rows": len(search_terms) * 24,
            "impressions": sum(r["impressions"] for r in search_terms),
            "clicks": sum(r["clicks"] for r in search_terms),
            "cost": _r2(sum(r["cost"] for r in search_terms)),
            "conversions": sum(r["conversions"] for r in search_terms),
            "ctr": _r4(sum(r["clicks"] for r in search_terms)
                       / max(1, sum(r["impressions"] for r in search_terms))),
            "avgCpc": _r2(sum(r["cost"] for r in search_terms)
                          / max(1, sum(r["clicks"] for r in search_terms))),
            "conversionRate": _r4(sum(r["conversions"] for r in search_terms)
                                  / max(1, sum(r["clicks"] for r in search_terms))),
            "costPerConversion": _r2(sum(r["cost"] for r in search_terms)
                                     / max(1, sum(r["conversions"] for r in search_terms))),
        },
        "conversions": [
            {"action": "application_started", "stage": "Early application milestone",
             "category": "Page view", "conversions": int(total_conv * 0.48), "weight": 1},
            {"action": "contact_details_submitted", "stage": "Contact info milestone",
             "category": "Contact", "conversions": int(total_conv * 0.41), "weight": 2},
            {"action": "prequalification_result", "stage": "Prequal result milestone",
             "category": "Page view", "conversions": int(total_conv * 0.11), "weight": 3},
        ],
        "inactiveConversionActions": [
            "Click to call from map listing",
            "Click to call from ad",
            "Mobile app installs",
        ],
        "campaigns": campaigns,
        "pausedMarkets": [f"{p} - {m}" for m, _, p in paused],
        "locations": locations,
        "keywords": sorted(keywords, key=lambda r: -r["conversions"]),
        "searchTerms": sorted(search_terms, key=lambda r: -r["conversions"]),
        "devices": devices,
        "dayparts": dayparts,
        "landingPages": landing,
        "auctionInsights": auction,
        "periodComparison": {
            "previousRange": "Jun 18 - Jul 17, 2026",
            "impressionsDelta": rng.randint(-140, 190),
            "costDelta": _r2(rng.uniform(-90, 120)),
            "conversionsDelta": _r2(rng.uniform(-18, 9)),
            "biggestChanges": biggest,
            "googleInsight": "Reported conversions fell across enabled campaigns in the "
                             "comparison window, driven mostly by campaigns that were "
                             "paused part-way through it.",
        },
        "diagnostics": [
            {"label": "Advertiser verification", "status": "Action required",
             "detail": "Account verification is outstanding and will stop delivery if it "
                       "is not completed."},
            {"label": "Campaign serving", "status": "Limited",
             "detail": "All enabled campaigns are marked Eligible (Limited) and are "
                       "targeting fewer searches than their budget allows."},
            {"label": "Optimization score", "status": "54.2%",
             "detail": "Enabled campaigns are clustered in the low fifties."},
            {"label": "Performance Max recommendation", "status": "+9% estimated",
             "detail": "Surfaced by the platform as a suggestion. Treat it as a test to "
                       "run, not a decision the dashboard is making."},
            {"label": "Ad strength", "status": "Average",
             "detail": "Responsive search ads are rated Average across enabled campaigns."},
        ],
        "searchThemes": [
            {"theme": "Loan intent",
             "examples": "small business loan; business loan near me; microloan lenders",
             "read": "Core demand. Compare against CRM inquiry volume by state and funded "
                     "outcomes before scaling spend."},
            {"theme": "Grant intent",
             "examples": "business grants for startups; small business grants",
             "read": "High volume, poor fit for a lending product. Watch milestone depth "
                     "rather than raw conversions."},
            {"theme": "Credit-constrained",
             "examples": "business loan bad credit; no collateral business loan",
             "read": "Mission-aligned but needs clear eligibility language so the landing "
                     "page does not overpromise."},
            {"theme": "Demographic-specific",
             "examples": "minority business loan; women owned business loan",
             "read": "Aligns with the demographic reach reported on the impact page. Keep "
                     "segmented so performance is readable."},
            {"theme": "Adjacent use cases",
             "examples": "commercial property loan; farm equipment financing",
             "read": "Segment separately so out-of-scope inquiries do not inflate "
                     "application-page milestones."},
        ],
        "creative": {
            "adType": "Responsive search ad",
            "visibleStrength": "Average",
            "activeRows": len(campaigns),
            "sharedLandingPath": f"{DEMO_DOMAIN}/apply",
            "primaryMessage": "Connect small business owners with community lenders and "
                              "advisory partners.",
        },
    }
