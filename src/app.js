const state = {
  data: null,
  currentPage: "overview",
  selectedCdfi: "All CDFIs",
  crmDatePreset: "last90",
  crmDateStart: "",
  crmDateEnd: "",
  crmDateBoundsKey: "",
  mapTopology: null,
  metricCatalog: [],
  metricCategory: "All",
  overviewMode: "internal",
};

const OVERVIEW_MODE_STORAGE_KEY = "clnDashboardOverviewMode";

const pageTitles = {
  overview: "Executive Overview",
  funnel: "CRM Funnel",
  geography: "Geography",
  impact: "Impact & Portfolio",
  partners: "CDFI Partner Health",
  marketing: "Marketing Intelligence",
  matcher: "Fee Reconciliation",
  analytics: "Advanced Analytics",
  kpiGuide: "KPI Guide",
  quality: "Data Quality",
};

const stateFipsToCode = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
  "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
  "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
};

// Paid-search figures are generated, like the rest of the demo dataset, and
// are loaded from data/paid_search.json at startup.
let googleAdsSample = {
  source: "Generated demo dataset",
  data_available: false,
  refresh_status: "loading",
  sample: true,
  account: { name: "Community Lending Network" },
  totals: {}, searchTermsTotal: {}, conversions: [], inactiveConversionActions: [],
  campaigns: [], pausedMarkets: [], locations: [], keywords: [], searchTerms: [],
  devices: [], dayparts: [], landingPages: [], auctionInsights: [],
  periodComparison: { biggestChanges: [] }, diagnostics: [], searchThemes: [],
  creative: {},
};

function marketingData(data) {
  const apiAds = data.google_ads || {};
  if (apiAds.data_available) {
    return { ...googleAdsSample, ...apiAds, sample: false };
  }
  return {
    ...googleAdsSample,
    apiStatus: apiAds,
    sample: true,
    refresh_status: apiAds.refresh_status || googleAdsSample.refresh_status,
  };
}

function googleAdsSetupDetail(ads) {
  const missing = ads.apiStatus?.missing_setup || [];
  if (!missing.length) return "No missing setup detail was reported.";
  const friendly = missing.map((item) => ({
    GOOGLE_ADS_CUSTOMER_ID: "Google Ads customer id",
    GOOGLE_ADS_DEVELOPER_TOKEN: "Google Ads developer token",
    GOOGLE_ADS_CLIENT_ID: "OAuth client id",
    GOOGLE_ADS_CLIENT_SECRET: "OAuth client secret",
    GOOGLE_ADS_REFRESH_TOKEN: "OAuth refresh token",
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: "manager account customer id",
  }[item] || item));
  return `Missing ${friendly.join(" and ")}. Put account-level values in config/google_ads_local.json or user environment variables; the developer token must come from Google Ads API Center in a manager account.`;
}

const analyticsModules = [
  { label: "Demand-to-Capital Gap", signal: "CRM state demand vs Live Data disbursed by state", action: "Find markets where inquiry demand is ahead of funded capacity." },
  { label: "Partner Capacity Index", signal: "Assigned CRM volume, approval movement, disbursement share, TA load, aging stress", action: "Separate high-demand bottlenecks from low-activity partner opportunities." },
  { label: "Marketing-to-CRM Attribution", signal: "Google Ads conversions, CDFI/market campaign names, CRM created dates, state and partner assignment", action: "Calculate cost per pre-screen, approval, funded loan, and deployed dollar." },
  { label: "Portfolio Stress Watch", signal: "30+ and 60+ DPD exposure, charge-offs, outstanding balance, partner concentration", action: "Flag partner and state risk before it becomes a board-reporting surprise." },
  { label: "Capital Recycling and Liquidity", signal: "Outstanding balance, cumulative disbursed, charge-offs, payoff timing when available", action: "Estimate redeployable capital and fundraising runway." },
  { label: "Equity Reach Score", signal: "Minority, women, LMI, geography, and loan size distribution", action: "Track whether capital is reaching intended segments without exposing borrower-level PII." },
  { label: "TA Intensity and Outcomes", signal: "TA hours by partner and business plus funded/portfolio outcomes", action: "Measure where technical assistance appears to move borrowers through the funnel." },
  { label: "Reporting Readiness Score", signal: "Workbook freshness, missing states, stale RDS impact tables, parser warnings", action: "Give leadership one confidence score before board or funder exports." },
  { label: "Anomaly Detection", signal: "Daily refresh deltas across CRM, loans, charge-offs, aging, and Google Ads placeholders", action: "Catch broken source files, sudden status shifts, or reporting outliers automatically." },
  { label: "Funder Narrative Pack", signal: "Impact totals, jobs per $1M, state reach, partner mix, demographics, portfolio risk", action: "Generate curated screenshots and export-ready notes for board and funder audiences." },
  { label: "Lead Velocity", signal: "New CRM pre-screens by day, week, state, and CDFI", action: "Show whether demand is accelerating before originations appear in Live Data." },
  { label: "Approval Pull-Through", signal: "CRM status movement from pre-screen to approved and funded when a join key is confirmed", action: "Find friction between demand, approval, and actual capital deployment." },
  { label: "Queue Aging", signal: "Unassigned and in-progress CRM items by age bucket and partner", action: "Turn stale pipeline records into a daily action list." },
  { label: "Market Whitespace", signal: "States with CRM demand, no disbursement, no active partner, or weak marketing coverage", action: "Prioritize new partner outreach and targeted campaigns." },
  { label: "Partner Concentration Risk", signal: "Share of disbursed, outstanding, delinquencies, and charge-offs by partner", action: "Spot over-reliance on a few CDFIs before it becomes portfolio risk." },
  { label: "Loan Size Distribution", signal: "Median, percentile bands, and small-dollar share by state and partner", action: "Separate a few large loans from broad-based reach." },
  { label: "Vintage Performance", signal: "Originations by quarter compared with aging, charge-offs, and outstanding balance", action: "Compare newer cohorts with older cohorts rather than mixing all loans together." },
  { label: "DPD Roll-Forward", signal: "Current, 30+, 60+, 90+ aging changes across refreshes", action: "Track movement into stress instead of only current delinquency levels." },
  { label: "Marketing Marginal Efficiency", signal: "Spend, conversions, CRM demand, approvals, funded loans, and deployed dollars by campaign", action: "Show which campaigns deserve the next dollar." },
  { label: "Documentation and Compliance SLA", signal: "Missing files, reporting freshness, partner uploads, and unresolved matcher records", action: "Make operational readiness visible before reporting deadlines." },
];

function money(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1_000) return `$${(number / 1_000).toFixed(1)}K`;
  return number.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function whole(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function shortDate(value) {
  if (!value) return "Not refreshed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function percent(part, wholeValue) {
  const denominator = Number(wholeValue || 0);
  if (!denominator) return "0%";
  return `${Math.round((Number(part || 0) / denominator) * 100)}%`;
}

function rate(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function setPage(page) {
  state.currentPage = page;
  document.body.dataset.currentPage = page;
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });
  document.querySelectorAll(".page").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.pagePanel === page);
  });
  document.querySelector("#page-title").textContent = pageTitles[page];
}

function setOverviewMode(mode) {
  state.overviewMode = mode === "board" ? "board" : "internal";
  try {
    localStorage.setItem(OVERVIEW_MODE_STORAGE_KEY, state.overviewMode);
  } catch (error) {
    // Local storage may be disabled in hardened browser profiles.
  }
  const panel = document.querySelector('[data-page-panel="overview"]');
  if (panel) {
    panel.classList.toggle("board-view", state.overviewMode === "board");
    panel.classList.toggle("internal-view", state.overviewMode === "internal");
  }
  document.querySelectorAll("[data-overview-mode]").forEach((button) => {
    const active = button.dataset.overviewMode === state.overviewMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  const purpose = document.querySelector("#overview-purpose");
  if (purpose) {
    purpose.innerHTML = state.overviewMode === "board"
      ? `<span>Use this for</span><strong>Screenshot-safe summary</strong>`
      : `<span>Use this for</span><strong>Operations and data-quality briefing</strong>`;
  }
}

function renderKpis(targetId, items) {
  const target = document.querySelector(`#${targetId}`);
  target.innerHTML = items.map((item) => `
    <article class="kpi-card">
      <div class="kpi-label">${item.label}</div>
      <div class="kpi-value">${item.value}</div>
      <div class="kpi-note">${item.note || ""}</div>
    </article>
  `).join("");
}

function renderOverviewKpis(items) {
  const target = document.querySelector("#overview-kpis");
  target.innerHTML = items.map((item) => `
    <article class="kpi-card">
      <div class="kpi-label">${item.label}</div>
      <div class="kpi-value">${item.value}</div>
      <div class="kpi-note">
        <span data-kpi-internal>${item.internalNote || item.note || ""}</span>
        <span data-kpi-board>${item.boardNote || item.note || ""}</span>
      </div>
    </article>
  `).join("");
}

function readinessTone(status) {
  if (status === "ready") return "ok";
  if (status === "not_ready" || status === "blocked") return "error";
  return "warning";
}

function cleanStatus(status) {
  return String(status || "unknown").replaceAll("_", " ");
}

function uniqueStateCount(rows) {
  return new Set((rows || []).map((row) => String(row.state || "").trim().toUpperCase()).filter((stateCode) => stateCode && stateCode !== "UNKNOWN" && stateCode !== "(BLANK)")).size;
}

function signedDelta(value, formatter = whole) {
  const number = Number(value || 0);
  if (!number) return "No change";
  return `${number > 0 ? "+" : ""}${formatter(number)}`;
}

function sourceDate(value) {
  if (!value) return "Not captured";
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function topRow(rows, key) {
  return [...(rows || [])].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0] || null;
}

function overviewNarrative({ totals, derived, preScreenTotal, crmStates, impactStates, partnersBelowStrong, readinessStatus }) {
  const stressTone = derived.delinquency_rate_30_plus > 0.08 || derived.chargeoff_rate_on_disbursed > 0.08;
  const readinessText = cleanStatus(readinessStatus);
  if (partnersBelowStrong.length && stressTone) {
    return `${money(totals.disbursed)} deployed with broad CRM demand, while portfolio stress and partner follow-up need the closest read.`;
  }
  if (partnersBelowStrong.length) {
    return `${money(totals.disbursed)} deployed across ${whole(impactStates)} funded states, with partner follow-up concentrated in ${whole(partnersBelowStrong.length)} CDFIs.`;
  }
  if (preScreenTotal > totals.originations) {
    return `${money(totals.disbursed)} deployed, with CRM demand still ahead of funded loan volume across ${whole(crmStates)} states.`;
  }
  return `${money(totals.disbursed)} deployed across ${whole(totals.originations)} loans, with the current package marked ${readinessText}.`;
}

function renderBoardStrip(targetId, items) {
  document.querySelector(`#${targetId}`).innerHTML = items.map((item) => `
    <div class="board-strip-item">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <em>${item.note || ""}</em>
    </div>
  `).join("");
}

function renderNarrativeExport(targetId, items) {
  document.querySelector(`#${targetId}`).innerHTML = `
    <div class="overview-section-header">
      <h3>Narrative Summary</h3>
      <span>Board and funder copy</span>
    </div>
    <div class="narrative-export-list">
      ${items.map((item) => `
        <p><strong>${item.label}</strong>${item.detail}</p>
      `).join("")}
    </div>
  `;
}

function quarterRow(rows, quarter) {
  return (rows || []).find((row) => row.quarter === quarter) || null;
}

function latestQuarterRow(rows) {
  return [...(rows || [])].filter((row) => row.quarter && row.quarter !== "Unknown").sort((a, b) => String(a.quarter).localeCompare(String(b.quarter))).at(-1) || null;
}

function renderBriefingRows(targetId, rows) {
  document.querySelector(`#${targetId}`).innerHTML = rows.map((row) => `
    <div class="briefing-row">
      <div class="briefing-marker ${row.tone || "neutral"}"></div>
      <div>
        <strong>${row.label}</strong>
        <span>${row.detail}</span>
      </div>
    </div>
  `).join("");
}

function renderAttentionRows(targetId, rows) {
  const cleanRows = rows.length ? rows : [{ tone: "ok", label: "No priority follow-up", detail: "The current cache has no urgent Overview-level action items." }];
  document.querySelector(`#${targetId}`).innerHTML = cleanRows.map((row) => `
    <div class="attention-row">
      <span class="tag ${row.tone || "warning"}">${row.tone || "note"}</span>
      <div>
        <strong>${row.label}</strong>
        <span>${row.detail}</span>
      </div>
    </div>
  `).join("");
}

function renderOverview(data) {
  const impact = data.impact || {};
  const totals = impact.totals || {};
  const derived = impact.derived_kpis || {};
  const rds = data.rds || {};
  const matcher = data.matcher || {};
  const reporting = data.reporting_readiness || {};
  const history = data.history || {};
  const deltas = history.deltas || {};
  const dataQuality = data.data_quality || {};
  const qualitySummary = dataQuality.summary || {};
  const sourceHealth = dataQuality.source_health || [];
  const partners = data.partner_health?.partners || [];
  const compliance = data.compliance || {};
  const preScreenRows = rds.pre_screen_status_by_cdfi || [];
  const preScreenTotal = sumRows(preScreenRows, "count");
  const approved = preScreenRows.filter((row) => row.status === "Approved").reduce((sum, row) => sum + Number(row.count || 0), 0);
  const unassigned = preScreenRows.filter((row) => row.status === "Unassigned").reduce((sum, row) => sum + Number(row.count || 0), 0);
  const crmStates = uniqueStateCount(rds.pre_screen_by_state || []);
  const impactStates = uniqueStateCount(impact.originations_by_state || []);
  const partnerCounts = partners.reduce((counts, partner) => {
    const tier = partner.tier || "unrated";
    counts[tier] = (counts[tier] || 0) + 1;
    return counts;
  }, {});
  const partnersBelowStrong = partners.filter((partner) => partner.tier !== "strong");
  const sourceErrors = sourceHealth.filter((source) => source.status === "error").length;
  const sourceWarnings = sourceHealth.filter((source) => source.status === "warning").length;
  const readinessStatus = reporting.status || "unknown";
  const readinessCopy = reporting.summary || "Reporting readiness has not been summarized yet.";
  const readiness = readinessTone(readinessStatus);
  const matcherNew = Number((matcher.status || {}).new || 0);
  const topPartner = topRow(impact.originations_by_partner || [], "disbursed");
  const topState = topRow(impact.originations_by_state || [], "disbursed");
  const actionParts = [];
  if (partnersBelowStrong.length) actionParts.push(`${whole(partnersBelowStrong.length)} partner follow-ups`);
  if (qualitySummary.issue_count) actionParts.push(`${whole(qualitySummary.issue_count)} data warnings`);
  if (matcherNew) actionParts.push(`${whole(matcherNew)} unresolved matcher records`);
  if (unassigned) actionParts.push(`${whole(unassigned)} unassigned CRM records`);
  if (compliance.content_parse_failures) actionParts.push(`${whole(compliance.content_parse_failures)} compliance parse misses`);
  const actionText = actionParts.length
    ? `Review ${actionParts.slice(0, 4).join(", ")}${actionParts.length > 4 ? ", and more" : ""}.`
    : "No priority internal follow-up is showing in the current cache.";
  const narrative = overviewNarrative({ totals, derived, preScreenTotal, crmStates, impactStates, partnersBelowStrong, readinessStatus });

  document.querySelector("#overview-lede").innerHTML = `
    <div>
      <p class="eyebrow">Morning snapshot</p>
      <h2>${narrative}</h2>
      <p>Current portfolio balance is ${money(totals.outstanding)}; CRM demand stands at ${whole(preScreenTotal)} pre-screen records across ${whole(crmStates)} states.</p>
    </div>
    <div class="overview-readiness ${readiness}" data-overview-internal>
      <span>Reporting readiness</span>
      <strong>${cleanStatus(readinessStatus)}</strong>
      <em>${readinessCopy}</em>
    </div>
  `;

  document.querySelector("#overview-action").innerHTML = `
    <span>Today</span>
    <strong>${actionText}</strong>
  `;
  document.querySelector("#overview-as-of").innerHTML = `
    <div><span>Impact basis</span><strong>Inception-to-date</strong></div>
    <div><span>Dashboard refreshed</span><strong>${shortDate(data.generated_at)}</strong></div>
    <div><span>Live Data through</span><strong>${sourceDate(totals.max_month)}</strong></div>
    <div><span>RDS CRM snapshot</span><strong>${cleanStatus(rds.refresh_status || "unknown")}</strong></div>
    <div><span>RDS last good</span><strong>${shortDate(rds.last_successful_refresh_at)}</strong></div>
  `;
  renderBoardStrip("overview-board-strip", [
    { label: "Capital Deployed", value: money(totals.disbursed), note: `${whole(totals.originations)} inception-to-date loans` },
    { label: "States Reached", value: whole(impactStates), note: `${topState?.state || "No state"} leads by deployed dollars` },
    { label: "Jobs Reported", value: whole(totals.jobs), note: `${whole(derived.jobs_per_million_deployed)} jobs per $1M` },
    { label: "Partner Network", value: whole(partners.length), note: `${topPartner?.partner || "No partner"} leads by deployed dollars` },
    { label: "Readiness", value: reporting.board_ready ? "Board ready" : "Internal only", note: reporting.board_ready ? "Current snapshot usable" : "Review Data Quality first" },
  ]);
  renderNarrativeExport("overview-narrative-export", [
    { label: "Capital: ", detail: `${money(totals.disbursed)} has been deployed inception-to-date across ${whole(totals.originations)} reported loans, with ${money(totals.outstanding)} currently outstanding.` },
    { label: "Reach: ", detail: `The fund reports activity in ${whole(impactStates)} funded states, ${whole(totals.jobs)} jobs, and ${whole(derived.jobs_per_million_deployed)} jobs per $1M deployed.` },
    { label: "Readiness: ", detail: reporting.board_ready ? "This snapshot is usable for board review." : "This snapshot should remain internal until Data Quality is reviewed." },
  ]);
  const velocity = impact.origination_velocity || {};
  const velocitySignalLabel = { sharp_decline: "Sharp Decline", declining: "Declining", stable: "Stable", growing: "Growing" }[velocity.signal] || "–";
  const par30 = derived.par_30 || 0;
  const par60 = derived.par_60 || 0;
  const par90 = derived.par_90 || 0;
  renderOverviewKpis([
    { label: "Deployed Capital", value: money(totals.disbursed), note: `${whole(totals.originations)} Live Data originations` },
    { label: "Active Portfolio", value: money(totals.outstanding), note: `${whole(totals.portfolio_loans)} active portfolio rows` },
    { label: "CRM Demand", value: whole(preScreenTotal), internalNote: `${whole(approved)} approved / ${whole(unassigned)} unassigned`, boardNote: "Current CRM pre-screen aggregate" },
    { label: "State Reach", value: `${whole(impactStates)} funded`, note: `${whole(crmStates)} CRM demand states` },
    { label: "Velocity Signal", value: velocitySignalLabel, note: velocity.last_quarter ? `${velocity.last_quarter}: ${whole(velocity.last_quarter_originations)} loans` : "Insufficient history" },
    { label: "Charge-off Rate", value: rate(derived.chargeoff_rate_on_disbursed), note: `${money(totals.chargeoff_amount)} charged off ITD` },
    { label: "12M Charge-off Rate", value: rate(derived.trailing_12m_chargeoff_rate), note: "Trailing 12-month charge-offs / outstanding" },
    { label: "PAR30", value: rate(par30), note: par30 > 0.08 ? "Above 8% CDFI benchmark" : "Within benchmark" },
    { label: "PAR60", value: rate(par60), note: par60 > 0.05 ? "Above 5% CDFI benchmark" : "Within benchmark" },
    { label: "PAR90", value: rate(par90), note: par90 > 0.03 ? "Above 3% CDFI benchmark" : "Within benchmark" },
  ]);

  renderBriefingRows("overview-briefing", [
    {
      tone: "ok",
      label: "Capital story",
      detail: `${money(totals.disbursed)} deployed, ${money(totals.outstanding)} outstanding, ${whole(totals.jobs)} reported jobs.`,
    },
    {
      tone: derived.delinquency_rate_30_plus > 0.08 || derived.chargeoff_rate_on_disbursed > 0.08 ? "warning" : "ok",
      label: "Portfolio posture",
      detail: `${rate(derived.delinquency_rate_30_plus)} 30+ DPD exposure, ${rate(derived.chargeoff_rate_on_disbursed)} ITD charge-off rate, ${rate(derived.trailing_12m_chargeoff_rate)} trailing 12M.`,
    },
    {
      tone: partnersBelowStrong.length ? "warning" : "ok",
      label: "Partner posture",
      detail: `${whole(partnerCounts.strong)} strong partners; ${whole(partnerCounts.watch)} watch; ${whole(partnerCounts.needs_attention)} needs attention.`,
    },
    {
      tone: sourceErrors ? "error" : sourceWarnings ? "warning" : "ok",
      label: "Source confidence",
      detail: `${whole(sourceHealth.length)} sources checked; ${whole(sourceWarnings)} warnings and ${whole(sourceErrors)} errors.`,
    },
    {
      tone: history.previous ? "ok" : "warning",
      label: "Daily movement",
      detail: history.previous
        ? `Since prior snapshot: ${signedDelta(deltas.disbursed, money)} deployed, ${signedDelta(deltas.originations)} loans, ${signedDelta(deltas.crm_pre_screen)} CRM pre-screens.`
        : `Baseline started on ${history.latest?.date || "the latest refresh"}; daily deltas will activate after another snapshot.`,
    },
  ]);

  const attention = [];
  if (readiness !== "ok") {
    attention.push({ tone: readiness, label: "Reporting package needs caveats", detail: readinessCopy });
  }
  if (partnersBelowStrong.length) {
    attention.push({
      tone: "warning",
      label: "Partner health follow-up",
      detail: `${whole(partnersBelowStrong.length)} partners are below strong: ${partnersBelowStrong.slice(0, 4).map((partner) => partner.partner).join(", ")}${partnersBelowStrong.length > 4 ? ", ..." : ""}.`,
    });
  }
  if (unassigned) {
    attention.push({ tone: "warning", label: "CRM unassigned queue", detail: `${whole(unassigned)} pre-screen records are currently unassigned.` });
  }
  if (matcherNew) {
    attention.push({ tone: "warning", label: "Matcher queue", detail: `${whole(matcherNew)} new marketing-fee match records are unresolved.` });
  }
  if (compliance.content_parse_failures) {
    attention.push({ tone: "warning", label: "Compliance parser follow-up", detail: `${whole(compliance.content_parse_failures)} of ${whole(compliance.content_files_attempted)} eligible files could not be parsed for content signals.` });
  }
  if (rds.refresh_status === "stale_snapshot") {
    attention.push({ tone: "warning", label: "RDS snapshot is stale", detail: "The dashboard is using the last successful aggregate RDS snapshot." });
  }
  if (sourceErrors || sourceWarnings) {
    attention.push({ tone: sourceErrors ? "error" : "warning", label: "Data quality review", detail: `${whole(qualitySummary.issue_count)} source warnings or issues are listed on Data Quality.` });
  }
  // Origination velocity alert
  if (velocity.signal === "sharp_decline") {
    attention.push({ tone: "error", label: "Origination velocity: sharp decline", detail: `${velocity.last_quarter || "Last quarter"} had only ${whole(velocity.last_quarter_originations)} originations — ${decimalRate(velocity.pct_of_trailing_avg)} of the trailing 4Q average. Review pipeline health immediately.` });
  } else if (velocity.signal === "declining") {
    attention.push({ tone: "warning", label: "Origination velocity: declining", detail: `${velocity.last_quarter || "Last quarter"} at ${decimalRate(velocity.pct_of_trailing_avg)} of trailing 4Q average (${whole(velocity.last_quarter_originations)} loans).` });
  }
  // 90+ DPD watch
  const dpdWatch = impact.ninety_plus_dpd_watch || [];
  if (dpdWatch.length) {
    const severe = dpdWatch.filter((r) => r.max_days_past_due > 270);
    const dpdTotal = dpdWatch.reduce((s, r) => s + r.outstanding, 0);
    attention.push({ tone: severe.length ? "error" : "warning", label: `90+ DPD watch: ${whole(dpdWatch.length)} partner${dpdWatch.length > 1 ? "s" : ""}`, detail: `${money(dpdTotal)} outstanding at 90+ DPD across ${dpdWatch.map((r) => r.partner).slice(0, 3).join(", ")}${dpdWatch.length > 3 ? ", ..." : ""}. ${severe.length ? `${whole(severe.length)} partner(s) exceed 270 DPD.` : ""}` });
  }
  // PAR ratio alerts
  if (par30 > 0.08) {
    attention.push({ tone: par30 > 0.15 ? "error" : "warning", label: `PAR30 above benchmark: ${rate(par30)}`, detail: `Portfolio at Risk (30+ DPD) exceeds the 8% CDFI sector benchmark. See Impact page for detail.` });
  }
  if (par60 > 0.05) {
    attention.push({ tone: par60 > 0.10 ? "error" : "warning", label: `PAR60 above benchmark: ${rate(par60)}`, detail: `Portfolio at Risk (60+ DPD) exceeds the 5% CDFI sector benchmark. See Impact page for detail.` });
  }
  if (par90 > 0.03) {
    attention.push({ tone: par90 > 0.07 ? "error" : "warning", label: `PAR90 above benchmark: ${rate(par90)}`, detail: `Portfolio at Risk (90+ DPD) exceeds the 3% CDFI sector benchmark. ${money(derived.par_90_outstanding)} outstanding at 90+ DPD.` });
  }
  // Partner concentration alert
  const pc = impact.partner_concentration || {};
  if (pc.hhi_disbursed > 2500) {
    attention.push({ tone: "warning", label: "Portfolio concentration risk", detail: `Partner HHI is ${whole(pc.hhi_disbursed)} (highly concentrated). ${pc.top_partner || "Top partner"} holds ${decimalRate(pc.top_partner_disbursed_share)} of deployed capital.` });
  }
  renderAttentionRows("overview-attention", attention.slice(0, 8));

  document.querySelector("#overview-jumps").innerHTML = [
    { page: "funnel", label: "CRM Funnel", metric: `${whole(preScreenTotal)} pre-screens`, note: "Demand, status mix, assignment backlog" },
    { page: "geography", label: "Geography", metric: `${whole(crmStates)} CRM states / ${whole(impactStates)} funded states`, note: "Demand and deployed capital by state" },
    { page: "partners", label: "Partners", metric: `${whole(partnersBelowStrong.length)} follow-ups`, note: "Health score, compliance readiness, portfolio posture" },
    { page: "impact", label: "Impact", metric: `${rate(derived.delinquency_rate_30_plus)} 30+ DPD`, note: "Portfolio, demographics, charge-offs, TA" },
    { page: "quality", label: "Data Quality", metric: cleanStatus(readinessStatus), note: "Source health, tests, reporting readiness" },
  ].map((item) => `
    <button class="overview-jump" data-jump-page="${item.page}">
      <span>${item.label}</span>
      <strong>${item.metric}</strong>
      <em>${item.note}</em>
    </button>
  `).join("");
  document.querySelectorAll("[data-jump-page]").forEach((button) => {
    button.addEventListener("click", () => setPage(button.dataset.jumpPage));
  });
  document.querySelectorAll("[data-overview-mode]").forEach((button) => {
    button.addEventListener("click", () => setOverviewMode(button.dataset.overviewMode));
  });
  setOverviewMode(state.overviewMode);
}

function renderBars(targetId, rows, valueKey, formatter = whole, limit = 12) {
  const target = document.querySelector(`#${targetId}`);
  const cleanRows = rows.filter((row) => row && row[valueKey] !== undefined).slice(0, limit);
  const max = Math.max(...cleanRows.map((row) => Number(row[valueKey] || 0)), 1);
  if (!cleanRows.length) {
    target.innerHTML = `<div class="empty-state">No aggregate data available yet.</div>`;
    return;
  }
  target.innerHTML = cleanRows.map((row) => {
    const label = row.partner || row.quarter || row.state || row.aging_band || row.label || row.key || "Unknown";
    const value = Number(row[valueKey] || 0);
    const width = Math.max((value / max) * 100, 1);
    return `
      <div class="bar-row">
        <div class="bar-row-header">
          <div class="bar-label">${label}</div>
          <div class="bar-value">${formatter(value)}</div>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      </div>
    `;
  }).join("");
}

function renderDictionaryBars(targetId, dictionary, formatter = whole) {
  const rows = Object.entries(dictionary || {})
    .map(([key, value]) => ({ key, label: key, value }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  renderBars(targetId, rows, "value", formatter, 14);
}

function numberOrZero(value) {
  return Number(value || 0);
}

function sumRows(rows, key) {
  return (rows || []).reduce((sum, row) => sum + numberOrZero(row[key]), 0);
}

function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(value, days) {
  const date = parseIsoDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function getCrmLeadRows(data) {
  const dailyRows = data.rds?.daily_pre_screen || [];
  if (dailyRows.length) {
    return dailyRows.map((row) => ({
      date: String(row.date || "").slice(0, 10),
      status: row.status || "(blank)",
      cdfi: row.cdfi || "(blank)",
      count: numberOrZero(row.count),
      approximate: false,
    }));
  }
  return (data.rds?.monthly_pre_screen || []).map((row) => ({
    date: String(row.month || "").slice(0, 10),
    status: row.status || "(blank)",
    cdfi: row.cdfi || "(blank)",
    count: numberOrZero(row.count),
    approximate: true,
  }));
}

function getCrmLeadDateBounds(data) {
  const dates = [...new Set(getCrmLeadRows(data).map((row) => row.date).filter(Boolean))].sort();
  return {
    min: dates[0] || "",
    max: dates[dates.length - 1] || "",
    key: dates.length ? `${dates[0]}:${dates[dates.length - 1]}:${dates.length}` : "empty",
  };
}

function applyCrmDatePreset(bounds, preset) {
  if (!bounds.min || !bounds.max) return { start: "", end: "", preset };
  const end = bounds.max;
  if (preset === "all") return { start: bounds.min, end, preset };
  if (preset === "ytd") {
    const endDate = parseIsoDate(end);
    return { start: `${endDate.getFullYear()}-01-01`, end, preset };
  }
  if (preset === "custom") {
    return {
      start: state.crmDateStart || bounds.min,
      end: state.crmDateEnd || end,
      preset,
    };
  }
  const windowDays = {
    last30: 29,
    last90: 89,
    last180: 179,
  }[preset] ?? 89;
  const start = addDays(end, -windowDays);
  return {
    start: start && start > bounds.min ? start : bounds.min,
    end,
    preset,
  };
}

function ensureCrmDateFilter(data) {
  const bounds = getCrmLeadDateBounds(data);
  if (!bounds.max) return bounds;
  if (state.crmDateBoundsKey !== bounds.key) {
    const resolved = applyCrmDatePreset(bounds, state.crmDatePreset || "last90");
    state.crmDateBoundsKey = bounds.key;
    state.crmDateStart = resolved.start;
    state.crmDateEnd = resolved.end;
    state.crmDatePreset = resolved.preset;
  }
  if (!state.crmDateStart || !state.crmDateEnd) {
    const resolved = applyCrmDatePreset(bounds, state.crmDatePreset || "last90");
    state.crmDateStart = resolved.start;
    state.crmDateEnd = resolved.end;
  }
  if (state.crmDateStart > state.crmDateEnd) {
    [state.crmDateStart, state.crmDateEnd] = [state.crmDateEnd, state.crmDateStart];
  }
  if (state.crmDateStart < bounds.min) state.crmDateStart = bounds.min;
  if (state.crmDateEnd > bounds.max) state.crmDateEnd = bounds.max;
  return bounds;
}

function aggregateCrmStatuses(rows) {
  const totals = new Map();
  rows.forEach((row) => {
    const key = `${row.cdfi}|||${row.status}`;
    totals.set(key, (totals.get(key) || 0) + numberOrZero(row.count));
  });
  return [...totals.entries()].map(([key, count]) => {
    const [cdfi, status] = key.split("|||");
    return { cdfi, status, count };
  });
}

function buildCrmFunnelRatesFromRows(rows) {
  const byCdfi = new Map();
  rows.forEach((row) => {
    if (!byCdfi.has(row.cdfi)) byCdfi.set(row.cdfi, {});
    const bucket = byCdfi.get(row.cdfi);
    bucket[row.status] = (bucket[row.status] || 0) + numberOrZero(row.count);
  });
  return [...byCdfi.entries()].map(([cdfi, statuses]) => {
    const total = Object.values(statuses).reduce((sum, value) => sum + numberOrZero(value), 0);
    const approved = numberOrZero(statuses.Approved);
    const denied = numberOrZero(statuses.Denied);
    const discarded = numberOrZero(statuses.Discarded);
    const inProgress = numberOrZero(statuses.InProgress);
    const unassigned = numberOrZero(statuses.Unassigned);
    const archived = numberOrZero(statuses.Archived);
    const sentForEducation = numberOrZero(statuses.SentForEducation);
    const active = approved + inProgress;
    return {
      cdfi,
      total,
      approved,
      denied,
      discarded,
      in_progress: inProgress,
      unassigned,
      archived,
      sent_for_education: sentForEducation,
      approved_rate: ratio(approved, total),
      denial_rate: ratio(denied, total),
      discard_rate: ratio(discarded, total),
      unassigned_rate: ratio(unassigned, total),
      active_rate: ratio(active, total),
    };
  }).sort((a, b) => b.total - a.total);
}

function buildCrmMonthlyVolumeFromRows(rows) {
  const monthly = new Map();
  rows.forEach((row) => {
    const month = `${String(row.date || "").slice(0, 7)}-01`;
    monthly.set(month, (monthly.get(month) || 0) + numberOrZero(row.count));
  });
  return [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
}

function buildCrmFilteredView(data) {
  const bounds = ensureCrmDateFilter(data);
  const sourceRows = getCrmLeadRows(data);
  const filteredRows = sourceRows.filter((row) => row.date >= state.crmDateStart && row.date <= state.crmDateEnd);
  const statusRows = aggregateCrmStatuses(filteredRows);
  const rates = buildCrmFunnelRatesFromRows(statusRows);
  const monthlyVolume = buildCrmMonthlyVolumeFromRows(filteredRows);
  const cdfiCount = new Set(filteredRows.map((row) => row.cdfi).filter((value) => value && value !== "(blank)" && value !== "Not Assigned")).size;
  const leadTotal = filteredRows.reduce((sum, row) => sum + numberOrZero(row.count), 0);
  const approx = sourceRows.some((row) => row.approximate);
  return {
    bounds,
    sourceRows,
    filteredRows,
    statusRows,
    rates,
    monthlyVolume,
    leadTotal,
    cdfiCount,
    approx,
    label: `${shortDate(state.crmDateStart)} to ${shortDate(state.crmDateEnd)}`,
  };
}

function bindCrmDateControls(data) {
  const preset = document.querySelector("#crm-date-preset");
  const start = document.querySelector("#crm-date-start");
  const end = document.querySelector("#crm-date-end");
  const summary = document.querySelector("#crm-date-summary");
  const exportBtn = document.querySelector("#crm-export-btn");
  if (!preset || !start || !end || !summary) return;
  const view = buildCrmFilteredView(data);
  preset.value = state.crmDatePreset;
  start.min = view.bounds.min;
  start.max = view.bounds.max;
  end.min = view.bounds.min;
  end.max = view.bounds.max;
  start.value = state.crmDateStart;
  end.value = state.crmDateEnd;
  summary.textContent = `${view.label} lead window${view.approx ? " (month-level approximation until next refresh)" : ""}`;
  if (exportBtn) {
    // Built in the browser rather than fetched, so the export works from a
    // static host.
    exportBtn.removeAttribute("href");
    exportBtn.onclick = (event) => {
      event.preventDefault();
      exportCrmFunnelCsv(state.crmDateStart, state.crmDateEnd);
    };
  }

  preset.onchange = () => {
    state.crmDatePreset = preset.value;
    const resolved = applyCrmDatePreset(view.bounds, state.crmDatePreset);
    state.crmDateStart = resolved.start;
    state.crmDateEnd = resolved.end;
    renderDashboard(state.data);
  };
  start.onchange = () => {
    state.crmDatePreset = "custom";
    state.crmDateStart = start.value || view.bounds.min;
    if (state.crmDateStart > state.crmDateEnd) state.crmDateEnd = state.crmDateStart;
    renderDashboard(state.data);
  };
  end.onchange = () => {
    state.crmDatePreset = "custom";
    state.crmDateEnd = end.value || view.bounds.max;
    if (state.crmDateEnd < state.crmDateStart) state.crmDateStart = state.crmDateEnd;
    renderDashboard(state.data);
  };
}

function formatMaybe(value, formatter = whole) {
  return value === undefined || value === null || value === "" ? "Not captured" : formatter(value);
}

function decimalRate(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function dollars(value) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function ratio(value, denominator) {
  return denominator ? Number(value || 0) / Number(denominator || 0) : 0;
}

function rateOrDash(value) {
  return value === null || value === undefined ? "-" : decimalRate(value);
}

function googleAdsMilestoneDepth(conversions) {
  const total = sumRows(conversions, "conversions");
  const weighted = (conversions || []).reduce((sum, row) => sum + Number(row.conversions || 0) * Number(row.weight || 1), 0);
  return total ? weighted / total : 0;
}

function stateAggregate(rows, key, stateCode) {
  return (rows || []).filter((row) => String(row.state || "").toUpperCase() === stateCode).reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function googleAdsDeviceSummary(ads) {
  const totals = ads.totals || {};
  const map = new Map();
  (ads.devices || []).forEach((row) => {
    const key = row.device || "Unknown";
    const current = map.get(key) || { device: key, clicks: 0, impressions: 0, cost: 0, conversions: 0 };
    current.clicks += Number(row.clicks || 0);
    current.impressions += Number(row.impressions || 0);
    current.cost += Number(row.cost || 0);
    current.conversions += Number(row.conversions || 0);
    map.set(key, current);
  });
  return [...map.values()].map((row) => ({
    ...row,
    ctr: ratio(row.clicks, row.impressions),
    avgCpc: ratio(row.cost, row.clicks),
    conversionRate: ratio(row.conversions, row.clicks),
    costPerConversion: row.conversions ? row.cost / row.conversions : 0,
    costShare: ratio(row.cost, totals.cost),
  })).sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0));
}

function googleAdsLandingPageSummary(ads) {
  const totals = ads.totals || {};
  return (ads.landingPages || []).map((row) => ({
    ...row,
    clickShare: ratio(row.clicks, totals.clicks),
    costShare: ratio(row.cost, totals.cost),
  }));
}

function googleAdsStateBridgeRows(data, ads) {
  const rds = data.rds || {};
  const impact = data.impact || {};
  return (ads.locations || []).map((row) => {
    const crmDemand = stateAggregate(rds.pre_screen_by_state || [], "count", row.state);
    const funded = stateAggregate(impact.originations_by_state || [], "originations", row.state);
    const disbursed = stateAggregate(impact.originations_by_state || [], "disbursed", row.state);
    return {
      ...row,
      crmDemand,
      funded,
      disbursed,
      costPerCrmDemand: crmDemand ? row.cost / crmDemand : null,
      adMilestonesPerCrmDemand: crmDemand ? row.conversions / crmDemand : null,
      costPerFundedLoan: funded ? row.cost / funded : null,
    };
  });
}

function stateHeatColor(value, max) {
  if (!value || !max) return "#eef3f8";
  const intensity = Math.log1p(Number(value)) / Math.log1p(Number(max));
  const lightness = 92 - intensity * 48;
  const saturation = 78 - intensity * 12;
  return `hsl(203 ${saturation}% ${lightness}%)`;
}

function stateTextColor(value, max) {
  if (!value || !max) return "#637083";
  const intensity = Math.log1p(Number(value)) / Math.log1p(Number(max));
  return intensity > 0.62 ? "#ffffff" : "#152033";
}

function decodeTopoArc(topology, arcIndex) {
  const scale = topology.transform?.scale || [1, 1];
  const translate = topology.transform?.translate || [0, 0];
  const rawArc = topology.arcs[arcIndex < 0 ? ~arcIndex : arcIndex] || [];
  let x = 0;
  let y = 0;
  const points = rawArc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
  return arcIndex < 0 ? points.reverse() : points;
}

function topoRingToPoints(topology, ring) {
  return ring.flatMap((arcIndex, index) => {
    const points = decodeTopoArc(topology, arcIndex);
    return index ? points.slice(1) : points;
  });
}

function exportDemographicsCsv() {
  const rows = state.data?.impact?.partner_demographics || [];
  const columns = ["partner", "originations", "disbursed", "minority", "minority_eligible",
                   "women", "women_coverage", "lmi_positive", "lmi_reported",
                   "lmi_coverage", "lmi_missing", "jobs", "ta_hours"];
  const csv = [columns.join(",")]
    .concat(rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")))
    .join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }),
               "partner_demographics.csv");
}

function exportCrmFunnelCsv(start, end) {
  const rows = (state.data?.rds?.monthly_pre_screen || []).filter((row) => {
    const month = String(row.month || "");
    return (!start || month >= String(start).slice(0, 7))
        && (!end || month <= String(end).slice(0, 7));
  });
  const columns = ["month", "cdfi", "status", "count"];
  const csv = [columns.join(",")]
    .concat(rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")))
    .join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }),
               `crm_funnel_${start || "start"}_${end || "end"}.csv`);
}

function topoGeometryToRings(topology, geometry) {
  if (geometry.type === "Polygon") {
    return geometry.arcs.map((ring) => topoRingToPoints(topology, ring));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.arcs.flatMap((polygon) => polygon.map((ring) => topoRingToPoints(topology, ring)));
  }
  return [];
}

function ringsToSvgPath(rings) {
  return rings.map((ring) => {
    const commands = ring.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
    return `${commands}Z`;
  }).join("");
}

function ringsBounds(rings) {
  const points = rings.flat();
  if (!points.length) return null;
  return points.reduce((bounds, [x, y]) => ({
    minX: Math.min(bounds.minX, x),
    minY: Math.min(bounds.minY, y),
    maxX: Math.max(bounds.maxX, x),
    maxY: Math.max(bounds.maxY, y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function renderStateHeatMap(targetId, rows, valueKey, formatter, ariaLabel, options = {}) {
  const target = document.querySelector(`#${targetId}`);
  const valueByState = new Map();
  const labelByState = new Map();
  const labelKey = options.labelKey || valueKey;
  const labelFormatter = options.labelFormatter || formatter;
  (rows || []).forEach((row) => {
    const code = String(row.state || "").trim().toUpperCase();
    if (!code || code === "(BLANK)" || code === "UNKNOWN") return;
    valueByState.set(code, (valueByState.get(code) || 0) + Number(row[valueKey] || 0));
    labelByState.set(code, (labelByState.get(code) || 0) + Number(row[labelKey] || 0));
  });
  const max = Math.max(...[...valueByState.values()], 1);
  const labelMax = Math.max(...[...labelByState.values()], 1);
  target.setAttribute("aria-label", ariaLabel);
  if (!state.mapTopology?.objects?.states?.geometries?.length) {
    target.innerHTML = `<div class="empty-state">Map geometry is not loaded yet.</div>`;
    return;
  }

  const topology = state.mapTopology;
  const bbox = topology.bbox || [0, 0, 960, 610];
  const viewBox = `${bbox[0]} ${bbox[1]} ${bbox[2] - bbox[0]} ${bbox[3] - bbox[1]}`;
  const labelCodes = new Set([...labelByState.entries()]
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, options.labelLimit || 18)
    .map(([code]) => code));
  const paths = [];
  const labels = [];
  topology.objects.states.geometries.forEach((geometry) => {
    const code = stateFipsToCode[String(geometry.id || "").padStart(2, "0")] || geometry.properties?.STUSAB;
    if (!code) return;
    const value = valueByState.get(code) || 0;
    const labelValue = labelByState.get(code) || 0;
    const rings = topoGeometryToRings(topology, geometry);
    const path = ringsToSvgPath(rings);
    const fill = stateHeatColor(value, max);
    const title = `${geometry.properties?.name || code}: ${value ? formatter(value) : "No reported value"}${labelKey !== valueKey ? `; ${options.labelName || "loans"}: ${whole(labelValue)}` : ""}`;
    paths.push(`<path class="state-shape" d="${path}" fill="${fill}" data-state="${code}" tabindex="0"><title>${title}</title></path>`);
    if (labelCodes.has(code)) {
      const bounds = ringsBounds(rings);
      if (bounds) {
        const x = (bounds.minX + bounds.maxX) / 2;
        const y = (bounds.minY + bounds.maxY) / 2;
        const textColor = stateTextColor(value || labelValue, value ? max : labelMax);
        labels.push(`
          <text class="state-label" x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="${textColor}">
            <tspan x="${x.toFixed(2)}" dy="-0.35em">${code}</tspan>
            <tspan class="state-label-value" x="${x.toFixed(2)}" dy="1.25em">${labelFormatter(labelValue)}</tspan>
          </text>
        `);
      }
    }
  });

  target.innerHTML = `
    <svg class="us-map" viewBox="${viewBox}" role="img" aria-label="${ariaLabel}">
      ${paths.join("")}
      ${labels.join("")}
    </svg>
    <div class="map-legend" aria-hidden="true">
      <span>Lower</span>
      <div class="map-gradient"></div>
      <span>Higher</span>
    </div>
  `;
}

function rowsForSelectedCdfi(impact) {
  if (state.selectedCdfi === "All CDFIs") return impact.originations_by_state || [];
  return (impact.originations_by_partner_state || []).filter((row) => row.partner === state.selectedCdfi);
}

function renderGeography(data) {
  const impact = data.impact || {};
  const rds = data.rds || {};
  const partners = [...new Set((impact.originations_by_partner_state || []).map((row) => row.partner).filter(Boolean))].sort();
  const filter = document.querySelector("#cdfi-state-filter");
  const previous = state.selectedCdfi;
  filter.innerHTML = ["All CDFIs", ...partners].map((partner) => `<option value="${partner}">${partner}</option>`).join("");
  state.selectedCdfi = partners.includes(previous) ? previous : "All CDFIs";
  filter.value = state.selectedCdfi;
  filter.onchange = () => {
    state.selectedCdfi = filter.value;
    renderGeography(data);
  };

  const crmRows = rds.pre_screen_by_state || [];
  const disbursedRows = rowsForSelectedCdfi(impact).slice().sort((a, b) => Number(b.disbursed || 0) - Number(a.disbursed || 0));
  const disbursedRankRows = disbursedRows.map((row) => ({
    state: row.state,
    originations: row.originations,
    disbursed: row.disbursed,
  }));
  renderStateHeatMap("crm-state-map", crmRows, "count", whole, "CRM PRE_SCREEN records by state", {
    labelKey: "count",
    labelFormatter: whole,
    labelName: "CRM records",
    labelLimit: 26,
  });
  renderStateHeatMap("impact-state-map", disbursedRows, "disbursed", money, "Live Data disbursed dollars by state and CDFI", {
    labelKey: "disbursed",
    labelFormatter: money,
    labelName: "disbursed",
    labelLimit: 24,
  });
  renderBars("crm-state-bars", crmRows.slice().sort((a, b) => Number(b.count || 0) - Number(a.count || 0)), "count", whole, 10);
  renderBars("impact-state-bars", disbursedRankRows, "disbursed", money, 10);
  const marketingOverlay = document.querySelector("#geo-marketing-overlay");
  if (marketingOverlay) {
    const bridgeRows = googleAdsStateBridgeRows(data, marketingData(data));
    marketingOverlay.innerHTML = bridgeRows.map((row) => `
      <div class="insight-row">
        <strong>${row.state}: ${row.partner}</strong>
        <span>${whole(row.conversions)} Google Ads application milestones, ${whole(row.crmDemand)} aggregate CRM pre-screens, ${whole(row.funded)} Live Data originations, and ${money(row.disbursed)} disbursed.</span>
        <em>${row.costPerCrmDemand ? `${dollars(row.costPerCrmDemand)} ad spend per aggregate CRM pre-screen in state.` : "CRM state denominator is not available."} This is geographic alignment, not borrower-level attribution.</em>
      </div>
    `).join("");
  }
}

function renderTrend(targetId, rows) {
  const target = document.querySelector(`#${targetId}`);
  const cleanRows = rows.filter((row) => row.quarter !== "Unknown");
  if (!cleanRows.length) {
    target.innerHTML = `<div class="empty-state">No trend data available yet.</div>`;
    return;
  }
  const width = 820;
  const height = 290;
  const pad = 34;
  const max = Math.max(...cleanRows.map((row) => Number(row.disbursed || 0)), 1);
  const step = cleanRows.length > 1 ? (width - pad * 2) / (cleanRows.length - 1) : 1;
  const points = cleanRows.map((row, index) => {
    const x = pad + index * step;
    const y = height - pad - (Number(row.disbursed || 0) / max) * (height - pad * 2);
    return { x, y, row };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  target.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Quarterly disbursed trend">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#dfe5ee" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#dfe5ee" />
      <path d="${path}" fill="none" stroke="#075aa6" stroke-width="4" stroke-linecap="round" />
      ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#c9dc21" stroke="#075aa6" stroke-width="2"><title>${point.row.quarter}: ${money(point.row.disbursed)}</title></circle>`).join("")}
      ${points.filter((_, index) => index % Math.ceil(points.length / 8) === 0 || index === points.length - 1).map((point) => `<text x="${point.x}" y="${height - 8}" text-anchor="middle" font-size="12" fill="#637083">${point.row.quarter}</text>`).join("")}
    </svg>
  `;
}

function mergePartnerRows(impact) {
  const map = new Map();
  ["originations_by_partner", "aging_by_partner", "chargeoffs_by_partner", "ta_by_partner"].forEach((key) => {
    (impact[key] || []).forEach((row) => {
      const partner = row.partner || "Unknown";
      map.set(partner, { ...(map.get(partner) || { partner }), ...row });
    });
  });
  return [...map.values()].sort((a, b) => Number(b.disbursed || 0) - Number(a.disbursed || 0));
}

function renderPartnerTable(rows) {
  const tbody = document.querySelector("#partner-table tbody");
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${row.partner}</strong></td>
      <td>${whole(row.originations)}</td>
      <td>${money(row.disbursed)}</td>
      <td>${money(row.outstanding)}</td>
      <td>${whole(row.ta_hours)}</td>
      <td>${whole(row.max_days_past_due)}</td>
    </tr>
  `).join("");
}

function renderPartnerHealthTable(rows) {
  const tbody = document.querySelector("#partner-health-table tbody");
  tbody.innerHTML = (rows || []).map((row) => `
    <tr>
      <td><strong>${row.partner}</strong></td>
      <td>${whole(row.health_score)}</td>
      <td>${row.tier || "Unrated"}</td>
      <td>${whole(row.metrics?.crm_pre_screen)}</td>
      <td>${whole(row.metrics?.max_days_past_due)}</td>
      <td>${whole(row.compliance?.document_count)} docs${row.compliance?.content_files_parsed ? ` / ${whole(row.compliance.content_files_parsed)} parsed` : ""}${row.compliance?.certificate_year ? ` / cert ${row.compliance.certificate_year}` : ""}${row.compliance?.content_score_adjustment ? ` / signal ${Number(row.compliance.content_score_adjustment).toFixed(1)}` : ""}</td>
    </tr>
  `).join("");
}

function renderComplianceTable(data) {
  const qc = data.quarterly_compliance || {};
  const orgs = qc.organizations || [];
  const allQuarters = qc.all_quarters || [];
  const currentQ = qc.current_quarter || "";

  // Populate quarter selector
  const select = document.getElementById("compliance-quarter-select");
  if (select) {
    select.innerHTML = allQuarters.slice().reverse().map((q) =>
      `<option value="${q}"${q === currentQ ? " selected" : ""}>${q}</option>`
    ).join("");
    if (!allQuarters.length) select.innerHTML = `<option value="">No data</option>`;
  }

  // Summary badges
  const badges = document.getElementById("compliance-summary-badges");
  if (badges && orgs.length) {
    const pass = orgs.filter((o) => o.compliance_status === "pass").length;
    const fail = orgs.filter((o) => o.compliance_status === "partial_fail" || o.compliance_status === "fail").length;
    const pending = orgs.filter((o) => o.compliance_status === "pending").length;
    badges.innerHTML = [
      pass ? `<span class="tag ok">${pass} Pass</span>` : "",
      fail ? `<span class="tag error">${fail} Fail</span>` : "",
      pending ? `<span class="tag warning">${pending} Pending</span>` : "",
    ].filter(Boolean).join("");
  }

  // Table
  const tbody = document.querySelector("#compliance-table tbody");
  if (!tbody) return;
  if (!orgs.length) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--muted);">No compliance data available. Run a refresh after uploading financial statements.</td></tr>`;
    return;
  }

  tbody.innerHTML = orgs.map((org) => {
    const ratios = org.ratios || {};
    const ratioCells = ["net_asset_ratio", "current_ratio", "change_in_net_assets", "operating_liquidity", "llr_ratio", "net_charge_off_ratio"]
      .map((key) => {
        const r = ratios[key];
        if (!r || r.value === null || r.value === undefined) return `<td style="color:var(--muted);">—</td>`;
        const badge = r.pass === true ? "ok" : r.pass === false ? "error" : "warning";
        return `<td><span class="tag ${badge}">${r.display_value || "—"}</span></td>`;
      }).join("");

    const statusMap = { pass: "ok", partial_fail: "error", fail: "error", pending: "warning" };
    const statusLabel = { pass: "Pass", partial_fail: "Partial Fail", fail: "Fail", pending: "Pending" };
    const riskMap = { low: "ok", moderate: "warning", high: "error", critical: "error", unknown: "warning" };

    const confPct = Math.round(org.parse_confidence || 0);
    const confClass = confPct >= 80 ? "ok" : confPct >= 60 ? "warning" : "error";

    // The generated PDFs lived on the server that produced them. This build has
    // no document store, so the state is shown without a download link.
    const certBtn = org.certificate_status === "generated" && org.certificate_path
      ? `<span class="tag ok" title="Generated. No document store in this build.">Cert ready</span>`
      : org.certificate_status === "error" ? `<span class="tag error">Error</span>` : `<span style="color:var(--muted);">—</span>`;

    const waiverBtn = org.waiver_status === "generated" && org.waiver_path
      ? `<span class="tag ok" title="Generated. No document store in this build.">Waiver ready</span>`
      : org.waiver_status === "not_needed" ? `<span style="color:var(--muted);">N/A</span>`
      : org.waiver_status === "error" ? `<span class="tag error">Error</span>` : `<span style="color:var(--muted);">—</span>`;

    return `<tr>
      <td><strong>${org.org_name}</strong></td>
      <td><span class="tag ${org.financial_statement_status === "received" ? "ok" : "warning"}">${org.financial_statement_status}</span></td>
      <td><span class="tag ${confClass}">${confPct}%</span></td>
      ${ratioCells}
      <td><span class="tag ${statusMap[org.compliance_status] || "warning"}">${statusLabel[org.compliance_status] || org.compliance_status}</span></td>
      <td><span class="tag ${riskMap[org.risk_level] || "warning"}">${org.risk_level}</span></td>
      <td>${certBtn}</td>
      <td>${waiverBtn}</td>
    </tr>`;
  }).join("");
}

function renderCrmMatrix(rows) {
  const target = document.querySelector("#crm-status-matrix");
  if (!target) return;
  if (!(rows || []).length) {
    target.innerHTML = `<div class="empty-state">No PRE_SCREEN status data available for the selected date range.</div>`;
    return;
  }
  const statuses = ["Unassigned", "InProgress", "Approved", "Denied", "Discarded", "SentForEducation", "Archived"];
  const byCdfi = new Map();
  rows.forEach((row) => {
    if (!byCdfi.has(row.cdfi)) byCdfi.set(row.cdfi, {});
    byCdfi.get(row.cdfi)[row.status] = row.count;
  });
  const sorted = [...byCdfi.entries()].sort((a, b) => {
    const aTotal = Object.values(a[1]).reduce((sum, value) => sum + Number(value || 0), 0);
    const bTotal = Object.values(b[1]).reduce((sum, value) => sum + Number(value || 0), 0);
    return bTotal - aTotal;
  });
  target.innerHTML = `
    <table>
      <thead><tr><th>CDFI</th>${statuses.map((status) => `<th>${status}</th>`).join("")}</tr></thead>
      <tbody>
        ${sorted.map(([cdfi, values]) => `<tr><td><strong>${cdfi}</strong></td>${statuses.map((status) => `<td>${whole(values[status])}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderQuality(data) {
  const sourceHealth = data.data_quality.source_health || [];
  document.querySelector("#source-health-list").innerHTML = sourceHealth.length
    ? sourceHealth.map((source) => `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${source.status || "warning"}">${source.status || "warning"}</span>${source.source}</div>
        <div class="quality-meta">
          ${source.detail || ""}
          ${source.last_successful_refresh_at ? `<br>Last good: ${shortDate(source.last_successful_refresh_at)}` : ""}
          ${source.using_cached_snapshot ? "<br>Using cached aggregate snapshot" : ""}
        </div>
      </div>
    `).join("")
    : `<div class="quality-item"><div class="quality-title"><span class="tag warning">warning</span>Source health not available</div><div class="quality-meta">Run a refresh to add source-health metadata to the cache.</div></div>`;

  const sources = data.data_quality.source_inventory || [];
  document.querySelector("#source-list").innerHTML = sources.map((source) => `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${source.status === "ok" ? "ok" : "error"}">${source.status}</span>${source.partner}</div>
      <div class="quality-meta">${source.source}<br>${shortDate(source.last_modified)}</div>
    </div>
  `).join("");

  const issues = data.data_quality.issues || [];
  document.querySelector("#issue-list").innerHTML = issues.length
    ? issues.map((issue) => `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${issue.severity || "warning"}">${issue.severity || "warning"}</span>${issue.source || "Dashboard"}</div>
        <div class="quality-meta">${issue.message}</div>
      </div>
    `).join("")
    : `<div class="quality-item"><div class="quality-title"><span class="tag ok">ok</span>No active warnings</div><div class="quality-meta">All inspected sources parsed successfully.</div></div>`;

  const readiness = data.reporting_readiness || {};
  document.querySelector("#reporting-readiness").innerHTML = `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${readiness.status === "ready" ? "ok" : readiness.status === "not_ready" ? "error" : "warning"}">${readiness.status || "unknown"}</span>Reporting readiness</div>
      <div class="quality-meta">${readiness.summary || "Readiness metadata is not available yet."}</div>
    </div>
    ${(readiness.checks || []).map((check) => `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${check.status || "warning"}">${check.status || "warning"}</span>${check.label}</div>
      </div>
    `).join("")}
  `;

  document.querySelector("#data-tests").innerHTML = (data.data_tests || []).map((test) => `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${test.status || "warning"}">${test.status || "warning"}</span>${test.name}</div>
      <div class="quality-meta">${test.detail}</div>
    </div>
  `).join("") || `<div class="quality-item"><div class="quality-title"><span class="tag warning">warning</span>No data tests loaded</div></div>`;

  document.querySelector("#audience-views").innerHTML = (data.audience_views || []).map((view) => `
    <div class="quality-item">
      <div class="quality-title">${view.audience}</div>
      <div class="quality-meta">${view.use}<br>${(view.recommended_pages || []).join(", ")}<br>${view.caveat}</div>
    </div>
  `).join("") || `<div class="quality-item"><div class="quality-title"><span class="tag warning">warning</span>No audience view metadata loaded</div></div>`;
}

function renderMarketing(data) {
  const rds = data.rds || {};
  const impact = data.impact || {};
  const totals = impact.totals || {};
  const ads = marketingData(data);
  const adsTotals = ads.totals;
  const milestoneDepth = googleAdsMilestoneDepth(ads.conversions);
  const activeMarketShare = ratio(adsTotals.enabledCampaignsInWindow, adsTotals.visibleCampaigns);
  const bestCampaign = [...ads.campaigns].sort((a, b) => Number(a.costPerConversion || Infinity) - Number(b.costPerConversion || Infinity))[0];
  const strongestMarket = [...ads.locations].sort((a, b) => Number(b.conversions || 0) - Number(a.conversions || 0))[0];
  const preScreenTotal = sumRows(rds.pre_screen_status_by_cdfi || [], "count");
  const deviceSummary = googleAdsDeviceSummary(ads);
  const landingSummary = googleAdsLandingPageSummary(ads);
  const primaryLandingPage = landingSummary[0] || null;
  const mobileSummary = deviceSummary.find((row) => row.device === "Mobile phones");
  const competitivePosition = (ads.auctionInsights || []).find((row) => row.domain === "You");
  const cpaValues = (ads.campaigns || []).map((row) => Number(row.costPerConversion || 0)).filter(Boolean);
  const cpaSpread = cpaValues.length ? `${dollars(Math.min(...cpaValues))} - ${dollars(Math.max(...cpaValues))}` : "Not available";

  renderKpis("marketing-kpis", [
    { label: "Ad Spend", value: dollars(adsTotals.cost), note: `${ads.dateRange}; ${ads.sample ? "sample until API is configured" : "Google Ads API cache"}` },
    { label: "Milestone Conversions", value: whole(adsTotals.conversions), note: "GA4 page milestones, not CRM/funded outcomes" },
    { label: "Cost / Milestone", value: dollars(adsTotals.costPerConversion), note: `${decimalRate(adsTotals.conversionRate)} milestone conversion rate` },
    { label: "Click Efficiency", value: decimalRate(adsTotals.ctr), note: `${whole(adsTotals.clicks)} clicks / ${whole(adsTotals.impressions)} impressions` },
    { label: "Milestone Depth", value: `${milestoneDepth.toFixed(1)} / 3`, note: "Weighted from knockout, contact, and prequal-result milestones" },
    { label: "Active Markets", value: `${whole(adsTotals.enabledCampaignsInWindow)} / ${whole(adsTotals.visibleCampaigns)}`, note: `${decimalRate(activeMarketShare)} of visible campaigns active in window` },
    { label: "Best Market CPA", value: dollars(bestCampaign?.costPerConversion), note: bestCampaign ? `${bestCampaign.partner} / ${bestCampaign.market}` : "Not available" },
    { label: "Market CPA Spread", value: cpaSpread, note: "Best-to-worst active market cost per milestone" },
    { label: "Primary LP Share", value: primaryLandingPage ? decimalRate(primaryLandingPage.clickShare) : "0.0%", note: primaryLandingPage ? `${whole(primaryLandingPage.clicks)} clicks routed to ${primaryLandingPage.page}` : "Landing page data unavailable" },
    { label: "Mobile Spend Mix", value: mobileSummary ? decimalRate(mobileSummary.costShare) : "0.0%", note: mobileSummary ? `${dollars(mobileSummary.cost)} mobile spend / ${whole(mobileSummary.conversions)} milestones` : "Device data unavailable" },
    { label: "Competitive IS", value: competitivePosition ? decimalRate(competitivePosition.impressionShare) : "0.0%", note: "Search impression share in auction insights" },
    { label: "Period Conv. Delta", value: signedDelta(ads.periodComparison.conversionsDelta, (value) => Number(value || 0).toFixed(1)), note: `vs ${ads.periodComparison.previousRange}; Google Ads selected comparison` },
  ]);

  document.querySelector("#marketing-campaign-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>CDFI / Market</th>
          <th>Status</th>
          <th>Cost</th>
          <th>Impressions</th>
          <th>Clicks</th>
          <th>CTR</th>
          <th>Conv. Rate</th>
          <th>Conversions</th>
          <th>Cost / Conv.</th>
          <th>Opt.</th>
        </tr>
      </thead>
      <tbody>
        ${ads.campaigns.map((row) => `
          <tr>
            <td><strong>${row.partner}</strong><br><span>${row.market}</span><br><span>Ad group: ${row.adGroup}</span></td>
            <td>${row.status}<br><span>${dollars(row.budget)} / day</span></td>
            <td>${dollars(row.cost)}</td>
            <td>${whole(row.impressions)}</td>
            <td>${whole(row.clicks)}</td>
            <td>${decimalRate(row.ctr)}</td>
            <td>${decimalRate(row.conversionRate)}</td>
            <td>${whole(row.conversions)}</td>
            <td>${dollars(row.costPerConversion)}</td>
            <td>${decimalRate(row.optimizationScore)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  renderBars(
    "marketing-conversions",
    ads.conversions.map((row) => ({ label: row.stage, conversions: row.conversions, note: row.action })),
    "conversions",
    whole,
    6,
  );

  const ladderRows = [
    { label: "Ad impressions", value: adsTotals.impressions, note: "Search demand seen by active campaigns" },
    { label: "Ad clicks", value: adsTotals.clicks, note: `${decimalRate(adsTotals.ctr)} CTR; ${dollars(adsTotals.avgCpc)} average CPC` },
    { label: "Application milestones", value: adsTotals.conversions, note: "GA4 page milestones, not CRM conversions" },
    { label: "Search-term milestones", value: ads.searchTermsTotal.conversions, note: `${whole(ads.searchTermsTotal.rows)} search terms; ${dollars(ads.searchTermsTotal.costPerConversion)} cost per milestone` },
    { label: "CRM pre-screens", value: preScreenTotal, note: "RDS aggregate, not row-linked to ads yet" },
    { label: "Reported originations", value: totals.originations, note: "Live Data source of truth" },
    { label: "Reported disbursed", value: totals.disbursed, formatter: money, note: "Live Data source of truth" },
  ];
  const max = Math.max(...ladderRows.map((row) => numberOrZero(row.value)), 1);
  document.querySelector("#marketing-ladder").innerHTML = ladderRows.map((row) => {
    const value = numberOrZero(row.value);
    return `
      <div class="ladder-row">
        <div>
          <strong>${row.label}</strong>
          <span>${row.note}</span>
        </div>
        <div class="ladder-value">${(row.formatter || whole)(value)}</div>
        <div class="ladder-track"><div style="width:${Math.max((value / max) * 100, 3)}%"></div></div>
      </div>
    `;
  }).join("");

  document.querySelector("#marketing-diagnostics").innerHTML = (ads.diagnostics || []).map((row) => `
    <div class="insight-row">
      <strong>${row.label}: ${row.status}</strong>
      <span>${row.detail}</span>
    </div>
  `).join("") + (ads.sample ? `
    <div class="insight-row">
      <strong>API refresh status: ${ads.refresh_status}</strong>
      <span>The page is still showing the read-only UI sample until the Google Ads API setup is complete. ${googleAdsSetupDetail(ads)}</span>
    </div>
  ` : "");

  document.querySelector("#marketing-change-list").innerHTML = `
    <div class="insight-row">
      <strong>Selected-period change</strong>
      <span>Impressions ${signedDelta(ads.periodComparison.impressionsDelta, whole)}, cost ${signedDelta(ads.periodComparison.costDelta, dollars)}, conversions ${signedDelta(ads.periodComparison.conversionsDelta, (value) => Number(value || 0).toFixed(1))} vs ${ads.periodComparison.previousRange}.</span>
      <em>${ads.periodComparison.googleInsight}</em>
    </div>
    ${(ads.periodComparison.biggestChanges || []).map((row) => `
      <div class="insight-row">
        <strong>${row.campaign}</strong>
        <span>${signedDelta(row.costDelta, dollars)} cost change / ${signedDelta(row.percentDelta, decimalRate)}. ${row.status}.</span>
      </div>
    `).join("")}
  `;

  renderBars(
    "marketing-location-bars",
    ads.locations.map((row) => ({
      label: `${row.partner} / ${row.state}`,
      conversions: row.conversions,
      cost: row.cost,
      costPerConversion: row.costPerConversion,
    })),
    "conversions",
    whole,
    8,
  );

  document.querySelector("#marketing-search-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Search term</th>
          <th>Campaign</th>
          <th>Clicks</th>
          <th>Cost</th>
          <th>Milestones</th>
          <th>Cost / Milestone</th>
          <th>Read</th>
        </tr>
      </thead>
      <tbody>
        ${ads.searchTerms.map((row) => {
          const grantIntent = row.term.toLowerCase().includes("grant");
          const noConversion = !row.conversions;
          return `
            <tr>
              <td><strong>${row.term}</strong></td>
              <td>${row.campaign}</td>
              <td>${whole(row.clicks)}</td>
              <td>${dollars(row.cost)}</td>
              <td>${whole(row.conversions)}</td>
              <td>${row.conversions ? dollars(row.costPerConversion) : "No milestones"}</td>
              <td>${grantIntent ? "Grant intent" : noConversion ? "Watch" : "Loan intent"}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  document.querySelector("#marketing-keyword-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Keyword</th>
          <th>Campaign</th>
          <th>Clicks</th>
          <th>Cost</th>
          <th>Milestones</th>
          <th>Cost / Milestone</th>
          <th>Conv. Rate</th>
        </tr>
      </thead>
      <tbody>
        ${ads.keywords.map((row) => `
          <tr>
            <td><strong>${row.keyword}</strong></td>
            <td>${row.campaign}</td>
            <td>${whole(row.clicks)}</td>
            <td>${dollars(row.cost)}</td>
            <td>${whole(row.conversions)}</td>
            <td>${dollars(row.costPerConversion)}</td>
            <td>${decimalRate(row.conversionRate)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  const bridgeRows = googleAdsStateBridgeRows(data, ads);
  document.querySelector("#marketing-bridge").innerHTML = `
    <div class="insight-row">
      <strong>Bridge rule</strong>
      <span>Google Ads milestones are application page completions. CRM and Live Data are aggregate-only until a validated UTM or non-PII join key is added.</span>
    </div>
    ${bridgeRows.map((row) => `
      <div class="insight-row">
        <strong>${row.partner} / ${row.state}</strong>
        <span>${whole(row.conversions)} ad milestones, ${whole(row.crmDemand)} CRM pre-screens, ${whole(row.funded)} funded Live Data loans, ${money(row.disbursed)} disbursed.</span>
        <em>${row.costPerCrmDemand ? `${dollars(row.costPerCrmDemand)} ad spend per aggregate CRM pre-screen in state` : "No CRM state demand mapped for denominator."}${row.costPerFundedLoan ? ` / ${dollars(row.costPerFundedLoan)} ad spend per funded loan in same state.` : ""}</em>
      </div>
    `).join("")}
  `;

  document.querySelector("#marketing-device-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Device</th>
          <th>Cost Share</th>
          <th>Cost</th>
          <th>Clicks</th>
          <th>CTR</th>
          <th>Milestones</th>
          <th>Cost / Milestone</th>
        </tr>
      </thead>
      <tbody>
        ${deviceSummary.map((row) => `
          <tr>
            <td><strong>${row.device}</strong></td>
            <td>${decimalRate(row.costShare)}</td>
            <td>${dollars(row.cost)}</td>
            <td>${whole(row.clicks)}</td>
            <td>${decimalRate(row.ctr)}</td>
            <td>${whole(row.conversions)}</td>
            <td>${row.conversions ? dollars(row.costPerConversion) : "No milestones"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.querySelector("#marketing-daypart-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Day / Hour</th>
          <th>Campaign</th>
          <th>Clicks</th>
          <th>Cost</th>
          <th>Milestones</th>
          <th>Cost / Milestone</th>
          <th>Read</th>
        </tr>
      </thead>
      <tbody>
        ${ads.dayparts.map((row) => `
          <tr>
            <td><strong>${row.day}</strong><br><span>${row.hour}</span></td>
            <td>${row.campaign}</td>
            <td>${whole(row.clicks)}</td>
            <td>${dollars(row.cost)}</td>
            <td>${whole(row.conversions)}</td>
            <td>${row.conversions ? dollars(row.costPerConversion) : "No milestones"}</td>
            <td>${row.conversions ? "Promising pocket" : "Watch before excluding"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.querySelector("#marketing-landing-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Landing page</th>
          <th>Click Share</th>
          <th>Clicks</th>
          <th>Impr.</th>
          <th>CTR</th>
          <th>Cost</th>
          <th>Read</th>
        </tr>
      </thead>
      <tbody>
        ${landingSummary.map((row) => `
          <tr>
            <td><strong>${row.page}</strong><br><span>${row.url}</span></td>
            <td>${decimalRate(row.clickShare)}</td>
            <td>${whole(row.clicks)}</td>
            <td>${whole(row.impressions)}</td>
            <td>${decimalRate(row.ctr)}</td>
            <td>${dollars(row.cost)}</td>
            <td>${row.clickShare > 0.90 ? "Primary route" : row.clicks ? "Low-click route" : "Impression-only"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.querySelector("#marketing-auction-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Imp. Share</th>
          <th>Overlap</th>
          <th>Above Us</th>
          <th>Top Page</th>
          <th>Abs. Top</th>
          <th>Outrank</th>
        </tr>
      </thead>
      <tbody>
        ${(ads.auctionInsights || []).map((row) => `
          <tr>
            <td><strong>${row.domain}</strong></td>
            <td>${row.impressionShareLabel || rateOrDash(row.impressionShare)}</td>
            <td>${rateOrDash(row.overlapRate)}</td>
            <td>${rateOrDash(row.positionAboveRate)}</td>
            <td>${rateOrDash(row.topOfPageRate)}</td>
            <td>${rateOrDash(row.absoluteTopOfPageRate)}</td>
            <td>${rateOrDash(row.outrankingShare)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.querySelector("#marketing-theme-list").innerHTML = (ads.searchThemes || []).map((row) => `
    <div class="insight-row">
      <strong>${row.theme}</strong>
      <span>${row.examples}</span>
      <em>${row.read}</em>
    </div>
  `).join("");

  document.querySelector("#marketing-creative-list").innerHTML = [
    { label: "Visible ad format", detail: `${ads.creative.adType}; visible ad strength was ${ads.creative.visibleStrength}.` },
    { label: "Message route", detail: `${ads.creative.activeRows} active ad rows share the ${ads.creative.sharedLandingPath} route.` },
    { label: "Copy promise", detail: ads.creative.primaryMessage },
    { label: "Naming control", detail: "Ad group naming appears mismatched against the campaign it sits under; keep campaign, ad group, partner, county, and state as separate fields." },
    { label: "Next creative test", detail: "Once API refresh exists, compare headline/asset combinations against deeper prequal-result milestones, not only early page completions." },
  ].map((row) => `
    <div class="insight-row">
      <strong>${row.label}</strong>
      <span>${row.detail}</span>
    </div>
  `).join("");

  document.querySelector("#marketing-next").innerHTML = [
    `Current conversion definition: Google Ads conversions are GA4 application page milestones. The dashboard should not label them as CRM conversions, approved loans, or funded loans.`,
    `Important data quality finding: several ad groups carry a lender prefix that does not match the campaign they sit under, so any rollup keyed on ad-group name attributes spend to the wrong partner. The connector should capture campaign and ad group as separate fields and flag mismatches rather than parsing the name.`,
    `API tables to build next: campaign_daily, ad_group_daily, ad_daily, location_daily, search_term_daily, keyword_daily, conversion_action_daily, device_daily, landing_page_daily, auction_insight_daily, daypart_daily, and google_ads_refresh_status.`,
    `Best next join key: enforce UTM campaign, UTM content, partner/CDFI, county, and state conventions so Google Ads can be compared directionally to CRM and Live Data without borrower PII.`,
    `Recommended analyst automation: negative-keyword candidates, low-intent grant term watchlist, daypart bid recommendations, landing-page routing QA, campaign naming QA, and marketing-to-funded-loan bridge once a non-PII join key exists.`,
  ].map((item) => `<div class="insight-row"><strong>${item}</strong></div>`).join("");
}

function renderAnalytics(data) {
  const impact = data.impact || {};
  const totals = impact.totals || {};
  const derived = impact.derived_kpis || {};
  const rds = data.rds || {};
  const preScreenTotal = sumRows(rds.pre_screen_status_by_cdfi || [], "count");
  const crmStateCount = new Set((rds.pre_screen_by_state || []).map((row) => String(row.state || "").toUpperCase()).filter(Boolean)).size;
  const impactStateCount = new Set((impact.originations_by_state || []).map((row) => String(row.state || "").toUpperCase()).filter(Boolean)).size;
  const outstandingRatio = totals.disbursed ? totals.outstanding / totals.disbursed : 0;

  renderKpis("advanced-kpis", [
    { label: "CRM Geography Coverage", value: `${whole(crmStateCount)} states`, note: "State field captured from CRM pre-screen results" },
    { label: "Impact Geography Coverage", value: `${whole(impactStateCount)} states`, note: "Live Data states with reported disbursements" },
    { label: "Outstanding / Disbursed", value: decimalRate(outstandingRatio), note: "Capital still outstanding vs cumulative disbursed" },
    { label: "CRM to Loans Bridge", value: `${whole(preScreenTotal)} / ${whole(totals.originations)}`, note: "Volume comparison only until rows are linked" },
    { label: "Jobs per $1M", value: whole(derived.jobs_per_million_deployed), note: "Impact efficiency metric" },
    { label: "30+ DPD Exposure", value: rate(derived.delinquency_rate_30_plus), note: `${money(derived.delinquent_outstanding_30_plus)} outstanding` },
    { label: "60+ DPD Stress", value: rate(derived.stress_rate_60_plus), note: `${money(derived.stress_outstanding_60_plus)} outstanding` },
    { label: "TA Hours / Business", value: whole(derived.ta_hours_per_business), note: "TA intensity signal" },
  ]);

  // Data Source Freshness — live panel replacing static "Best Next KPI Modules"
  const sourceHealth = (data.data_quality?.source_health || []);
  const sourceFreshnessRows = sourceHealth.length
    ? sourceHealth.map(s => {
        const tone = s.status === "ok" ? "ok" : s.status === "warning" ? "warning" : "error";
        return `<div class="insight-row">
          <span class="tag ${tone}">${s.status || "unknown"}</span>
          <strong>${s.source || "—"}</strong>
          <span>${s.note || (s.modified_at ? `Last modified ${shortDate(s.modified_at)}` : "No freshness data")}</span>
        </div>`;
      }).join("")
    : `<div class="insight-row"><strong>No source health data available.</strong><span>Run refresh to populate.</span></div>`;
  document.querySelector("#analytics-modules").innerHTML = sourceFreshnessRows;

  // Recent Snapshot Changes — live panel replacing static "Executive Questions"
  const dailyHistory = (data.history?.daily || []).slice().reverse().slice(0, 7);
  const snapshotRows = dailyHistory.length >= 2
    ? dailyHistory.slice(0, -1).map((snap, i) => {
        const prev = dailyHistory[i + 1] || {};
        const dOrig = (snap.originations || 0) - (prev.originations || 0);
        const dDisb = (snap.disbursed || 0) - (prev.disbursed || 0);
        const dOut = (snap.outstanding || 0) - (prev.outstanding || 0);
        const dCrm = (snap.crm_pre_screen || 0) - (prev.crm_pre_screen || 0);
        const fmt = (v, fn) => v === 0 ? "<span style='color:var(--text-muted)'>—</span>" : `<span style='color:${v > 0 ? "var(--green-400,#4caf50)" : "var(--red-400,#ef5350)"}'>${v > 0 ? "+" : ""}${fn(v)}</span>`;
        return `<div class="insight-row" style="display:grid;grid-template-columns:6rem 1fr 1fr 1fr 1fr;gap:0.5rem;align-items:center;font-size:0.8rem;">
          <strong>${snap.date || "—"}</strong>
          <span>Originations ${fmt(dOrig, whole)}</span>
          <span>Disbursed ${fmt(dDisb, money)}</span>
          <span>Outstanding ${fmt(dOut, money)}</span>
          <span>CRM ${fmt(dCrm, whole)}</span>
        </div>`;
      }).join("")
    : `<div class="insight-row"><strong>Insufficient history for delta table.</strong><span>Daily deltas appear after two or more snapshots are recorded.</span></div>`;
  document.querySelector("#analytics-questions").innerHTML = snapshotRows;

  renderDemandGapAnalysis(data);
  renderPortfolioStressWatch(data);
  renderMonthlyTrend("analytics-monthly-trend", data.impact?.monthly_originations, "originations", whole, "Monthly originations — Advanced Analytics");
  renderEfficiencyRanking(data);
  renderEquityReach(data);
}

function renderCrmBridge(data) {
  const bridge = data.crm_bridge || {};
  const totals = bridge.totals || {};
  const rows = (bridge.by_partner || []).slice(0, 8);
  document.querySelector("#crm-bridge").innerHTML = `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${bridge.direct_row_link_available ? "ok" : "warning"}">${bridge.method || "bridge"}</span>CRM to funded loan bridge</div>
      <div class="quality-meta">
        ${bridge.reason || "No bridge metadata available."}<br>
        CRM pre-screens: ${whole(totals.crm_pre_screen)} / approved: ${whole(totals.crm_approved)} / Live Data originations: ${whole(totals.live_originations)}
      </div>
    </div>
    ${rows.map((row) => `
      <div class="quality-item">
        <div class="quality-title">${row.partner}</div>
        <div class="quality-meta">CRM ${whole(row.crm_pre_screen)} / originations ${whole(row.live_originations)} / disbursed ${money(row.live_disbursed)}</div>
      </div>
    `).join("")}
  `;
}

function renderHistorySummary(data) {
  const history = data.history || {};
  const latest = history.latest || {};
  const previous = history.previous || {};
  const deltas = history.deltas || {};
  document.querySelector("#history-summary").innerHTML = `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${history.available ? "ok" : "warning"}">${history.available ? "ok" : "warning"}</span>Daily snapshot baseline</div>
      <div class="quality-meta">
        Latest snapshot: ${latest.date || "Not available"}<br>
        Previous snapshot: ${previous.date || "Not available yet"}<br>
        Stored days: ${whole((history.daily || []).length)}
      </div>
    </div>
    <div class="quality-item">
      <div class="quality-title">Latest deltas</div>
      <div class="quality-meta">
        Disbursed: ${money(deltas.disbursed)} / Originations: ${whole(deltas.originations)} / CRM PRE_SCREEN: ${whole(deltas.crm_pre_screen)}
      </div>
    </div>
  `;
}

function renderMetricGuide() {
  const catalog = state.metricCatalog || [];
  const filter = document.querySelector("#metric-category-filter");
  if (!filter) return;

  const categories = ["All", ...new Set(catalog.map((item) => item.category).filter(Boolean))];
  const previous = state.metricCategory;
  filter.innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join("");
  state.metricCategory = categories.includes(previous) ? previous : "All";
  filter.value = state.metricCategory;
  filter.onchange = () => {
    state.metricCategory = filter.value;
    renderMetricGuide();
  };

  const rows = state.metricCategory === "All"
    ? catalog
    : catalog.filter((item) => item.category === state.metricCategory);
  const target = document.querySelector("#metric-guide");
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state">No KPI definitions are available yet.</div>`;
    return;
  }
  target.innerHTML = rows.map((item) => `
    <article class="metric-definition">
      <div class="metric-definition-head">
        <div>
          <span class="tag metric-category">${item.category}</span>
          <h4>${item.name}</h4>
        </div>
        <span class="confidence ${String(item.confidence || "").toLowerCase()}">${item.confidence || "Unrated"}</span>
      </div>
      <p>${item.measures}</p>
      <dl>
        <div><dt>Formula</dt><dd>${item.formula}</dd></div>
        <div><dt>Source</dt><dd>${item.source}</dd></div>
        <div><dt>Grain</dt><dd>${item.grain}</dd></div>
        <div><dt>Refresh</dt><dd>${item.refresh}</dd></div>
        <div><dt>Caveat</dt><dd>${item.caveat}</dd></div>
      </dl>
    </article>
  `).join("");
}

// ── Velocity ──────────────────────────────────────────────────────────────────
function renderVelocityPanel(data) {
  const velocity = data.impact?.origination_velocity || {};
  const signal = velocity.signal || "insufficient_data";
  const tone = signal === "sharp_decline" ? "error" : signal === "declining" ? "warning" : signal === "growing" ? "ok" : "neutral";
  const signalLabel = { sharp_decline: "Sharp Decline", declining: "Declining", stable: "Stable", growing: "Growing", insufficient_data: "Insufficient Data" }[signal] || signal;

  const velocityKpis = document.querySelector("#velocity-kpis");
  if (velocityKpis) {
    velocityKpis.innerHTML = [
      { label: "Velocity Signal", value: signalLabel, note: `${velocity.last_quarter || "–"} vs trailing 4Q avg` },
      { label: "Last Quarter", value: whole(velocity.last_quarter_originations), note: `${money(velocity.last_quarter_disbursed)} deployed in ${velocity.last_quarter || "–"}` },
      { label: "Trailing 4Q Avg", value: `${velocity.trailing_4q_avg_originations ?? "–"} loans`, note: `${money(velocity.trailing_4q_avg_disbursed)} avg deployed` },
      { label: "% of Trailing Avg", value: velocity.pct_of_trailing_avg != null ? decimalRate(velocity.pct_of_trailing_avg) : "–", note: "Last quarter originations / 4Q average" },
      { label: "QoQ Change", value: velocity.qoq_change != null ? signedDelta(velocity.qoq_change, decimalRate) : "–", note: "Quarter-over-quarter origination change" },
    ].map((item) => `
      <article class="kpi-card ${item.label === "Velocity Signal" ? tone : ""}">
        <div class="kpi-label">${item.label}</div>
        <div class="kpi-value">${item.value}</div>
        <div class="kpi-note">${item.note}</div>
      </article>
    `).join("");
  }

  const velocityDetail = document.querySelector("#velocity-detail");
  if (velocityDetail) {
    const rows = [];
    if (signal === "sharp_decline") {
      rows.push({ tone: "error", label: "Volume cliff detected", detail: `${velocity.last_quarter || "–"} had ${whole(velocity.last_quarter_originations)} originations — only ${decimalRate(velocity.pct_of_trailing_avg)} of the trailing 4Q average of ${velocity.trailing_4q_avg_originations || "–"}/quarter.` });
    } else if (signal === "declining") {
      rows.push({ tone: "warning", label: "Volume below average", detail: `${velocity.last_quarter || "–"} had ${whole(velocity.last_quarter_originations)} originations — ${decimalRate(velocity.pct_of_trailing_avg)} of trailing 4Q average.` });
    } else if (signal === "growing") {
      rows.push({ tone: "ok", label: "Volume above average", detail: `${velocity.last_quarter || "–"} had ${whole(velocity.last_quarter_originations)} originations — ${decimalRate(velocity.pct_of_trailing_avg)} of trailing 4Q average.` });
    } else if (signal === "stable") {
      rows.push({ tone: "ok", label: "Volume tracking average", detail: `${velocity.last_quarter || "–"} had ${whole(velocity.last_quarter_originations)} originations — tracking within 10% of the trailing 4Q average.` });
    } else {
      rows.push({ tone: "neutral", label: "Insufficient history", detail: "Need at least 5 quarters of data to compute velocity signal." });
    }
    if (velocity.qoq_change != null) {
      rows.push({ tone: Math.abs(velocity.qoq_change) < 0.1 ? "ok" : velocity.qoq_change < 0 ? "warning" : "ok", label: "QoQ movement", detail: `${signedDelta(velocity.qoq_change, decimalRate)} quarter-over-quarter. Watch for sequential deterioration.` });
    }
    velocityDetail.innerHTML = rows.map((row) => `
      <div class="insight-row ${row.tone}">
        <strong>${row.label}</strong>
        <span>${row.detail}</span>
      </div>
    `).join("");
  }
}

// ── Capital Recycling ──────────────────────────────────────────────────────────
function renderCapitalRecycling(targetId, recycling) {
  const target = document.querySelector(`#${targetId}`);
  if (!target || !recycling) return;
  const flows = [
    { label: "Total Capital Deployed (ITD)", value: money(recycling.total_disbursed), pct: "100%", tone: "ok" },
    { label: "Currently Outstanding", value: money(recycling.outstanding), pct: decimalRate(recycling.outstanding_pct), tone: "ok" },
    { label: "Implied Repaid / Recycled", value: money(recycling.implied_repaid), pct: decimalRate(recycling.repaid_pct), tone: "ok" },
    { label: "Charged Off", value: money(recycling.chargeoff_amount), pct: decimalRate(recycling.chargeoff_pct), tone: recycling.chargeoff_pct > 0.08 ? "warning" : "ok" },
  ];
  target.innerHTML = flows.map((row) => `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${row.tone}">${row.pct}</span>${row.label}</div>
      <div class="quality-meta">${row.value}</div>
    </div>
  `).join("");
}

// ── Concentration overview ────────────────────────────────────────────────────
function renderConcentrationOverview(data) {
  const pc = data.impact?.partner_concentration || {};
  const gc = data.impact?.geographic_concentration || {};
  const target = document.querySelector("#concentration-overview");
  if (!target) return;
  const hhi = pc.hhi_disbursed || 0;
  const hhiLabel = hhi > 2500 ? "Highly concentrated" : hhi > 1500 ? "Moderately concentrated" : "Diversified";
  const hhiTone = hhi > 2500 ? "warning" : "ok";
  target.innerHTML = [
    { label: `Partner HHI: ${hhiLabel}`, detail: `HHI ${whole(hhi)} — top partner ${pc.top_partner || "–"} holds ${decimalRate(pc.top_partner_disbursed_share)} of deployed capital across ${whole(pc.partner_count)} CDFIs.` },
    { label: `Top 3 States: ${decimalRate(gc.top3_disbursed_share)} of deployed capital`, detail: `${(gc.top3_states || []).join(", ")} account for the majority of funded loans. ${whole(gc.funded_state_count)} total funded states.` },
    { label: `Geographic lead: ${gc.most_concentrated_state || "–"}`, detail: `${gc.most_concentrated_state || "–"} alone represents ${decimalRate(gc.most_concentrated_state_share)} of all disbursed capital.` },
  ].map((row, i) => `
    <div class="insight-row ${i === 0 ? hhiTone : ""}">
      <strong>${row.label}</strong>
      <span>${row.detail}</span>
    </div>
  `).join("");
}

// ── Monthly trend chart (generic) ─────────────────────────────────────────────
function renderMonthlyTrend(targetId, rows, valueKey, formatter, ariaLabel) {
  const target = document.querySelector(`#${targetId}`);
  if (!target) return;
  const cleanRows = (rows || []).filter((row) => row[valueKey] !== undefined && row.month && row.month !== "Unknown");
  if (!cleanRows.length) {
    target.innerHTML = `<div class="empty-state">No monthly trend data available yet.</div>`;
    return;
  }
  const width = 820;
  const height = 220;
  const pad = 36;
  const max = Math.max(...cleanRows.map((row) => Number(row[valueKey] || 0)), 1);
  const step = cleanRows.length > 1 ? (width - pad * 2) / (cleanRows.length - 1) : 1;
  const points = cleanRows.map((row, index) => ({
    x: pad + index * step,
    y: height - pad - (Number(row[valueKey] || 0) / max) * (height - pad * 2),
    row,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const showEveryN = Math.ceil(points.length / 12);
  target.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#dfe5ee" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#dfe5ee" />
      <path d="${path}" fill="none" stroke="#075aa6" stroke-width="3" stroke-linecap="round" />
      ${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#c9dc21" stroke="#075aa6" stroke-width="2"><title>${p.row.month?.slice(0, 7) || ""}: ${formatter(p.row[valueKey])}</title></circle>`).join("")}
      ${points.filter((_, i) => i % showEveryN === 0 || i === points.length - 1).map((p) => `<text x="${p.x}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#637083">${String(p.row.month || "").slice(0, 7)}</text>`).join("")}
    </svg>
  `;
}

// ── CRM Funnel Rates ──────────────────────────────────────────────────────────
function renderFunnelRates(rates, label = "") {
  const target = document.querySelector("#crm-funnel-rates");
  if (!target) return;
  if (!rates.length) {
    target.innerHTML = `<div class="empty-state">No funnel rate data available for ${label || "the selected date range"}.</div>`;
    return;
  }
  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>CDFI</th>
          <th>Total</th>
          <th>Active</th>
          <th>Approved</th>
          <th>In Progress</th>
          <th>Unassigned</th>
          <th>Denied</th>
          <th>Discarded</th>
          <th>Edu</th>
          <th>Approved %</th>
          <th>Denial %</th>
          <th>Discard %</th>
          <th>Unassigned %</th>
        </tr>
      </thead>
      <tbody>
        ${rates.map((row) => `
          <tr>
            <td><strong>${row.cdfi}</strong></td>
            <td>${whole(row.total)}</td>
            <td>${whole(row.in_progress + row.approved)}</td>
            <td>${whole(row.approved)}</td>
            <td>${whole(row.in_progress)}</td>
            <td class="${row.unassigned_rate > 0.3 ? "cell-warning" : ""}">${whole(row.unassigned)}</td>
            <td>${whole(row.denied)}</td>
            <td>${whole(row.discarded)}</td>
            <td>${whole(row.sent_for_education)}</td>
            <td>${decimalRate(row.approved_rate)}</td>
            <td class="${row.denial_rate > 0.2 ? "cell-warning" : ""}">${decimalRate(row.denial_rate)}</td>
            <td class="${row.discard_rate > 0.3 ? "cell-warning" : ""}">${decimalRate(row.discard_rate)}</td>
            <td class="${row.unassigned_rate > 0.3 ? "cell-warning" : ""}">${decimalRate(row.unassigned_rate)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ── Stage abandonment ─────────────────────────────────────────────────────────
function renderStageAbandonment(data) {
  const stageStatus = data.rds?.stage_status || [];
  // Status labels have arrived from the CRM in more than one casing, so match
  // on the normalized value rather than an exact string.
  const unassignedByStage = stageStatus
    .filter((row) => {
      const status = String(row.status || "").trim().toLowerCase();
      return status === "unassigned" || status === "(blank)" || status === "";
    })
    .reduce((acc, row) => {
      acc[row.stage] = (acc[row.stage] || 0) + row.count;
      return acc;
    }, {});
  const rows = Object.entries(unassignedByStage)
    .map(([stage, count]) => ({ label: stage.replace(/_/g, " "), count }))
    .sort((a, b) => b.count - a.count);
  renderBars("stage-abandonment", rows, "count", whole, 10);
}

// ── Loan size distribution ────────────────────────────────────────────────────
function renderLoanSizeBuckets(data) {
  const dist = data.impact?.loan_size_distribution || {};
  const totalLoans = Object.values(dist).reduce((s, b) => s + (b.loans || 0), 0);
  const target = document.querySelector("#loan-size-distribution");
  if (!target) return;
  const rows = [
    { key: "small_dollar", label: "Small Dollar (< $25K)" },
    { key: "mid_market", label: "Mid-Market ($25K – $100K)" },
    { key: "large", label: "Large (> $100K)" },
  ].map(({ key, label }) => ({
    label,
    loans: dist[key]?.loans || 0,
    disbursed: dist[key]?.disbursed || 0,
    loanShare: totalLoans ? (dist[key]?.loans || 0) / totalLoans : 0,
  }));
  const maxDisbursed = Math.max(...rows.map((r) => r.disbursed), 1);
  target.innerHTML = rows.map((row) => `
    <div class="bar-row">
      <div class="bar-row-header">
        <div class="bar-label">${row.label}<br><em>${whole(row.loans)} loans (${decimalRate(row.loanShare)})</em></div>
        <div class="bar-value">${money(row.disbursed)}</div>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max((row.disbursed / maxDisbursed) * 100, 1)}%"></div></div>
    </div>
  `).join("");
}

// ── 90+ DPD watch ─────────────────────────────────────────────────────────────
function renderDpdWatch(targetId, data) {
  const target = document.querySelector(`#${targetId}`);
  if (!target) return;
  const watch = data.impact?.ninety_plus_dpd_watch || [];
  if (!watch.length) {
    target.innerHTML = `<div class="quality-item"><div class="quality-title"><span class="tag ok">ok</span>No 90+ DPD balances reported</div><div class="quality-meta">All aging balances are under 90 days past due.</div></div>`;
    return;
  }
  target.innerHTML = watch.map((row) => {
    const severe = row.max_days_past_due > 270;
    return `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${severe ? "error" : "warning"}">${row.max_days_past_due} DPD</span>${row.partner}</div>
        <div class="quality-meta">${whole(row.loans)} loans — ${money(row.outstanding)} outstanding at 90+ DPD${severe ? " — exceeds 270 days, potential loss event" : ""}.</div>
      </div>
    `;
  }).join("");
}

// ── Vintage / cohort table ─────────────────────────────────────────────────────
function renderCohortTable(data) {
  const target = document.querySelector("#cohort-table");
  if (!target) return;
  const cohorts = (data.impact?.cohort_performance || []).slice().reverse();
  if (!cohorts.length) {
    target.innerHTML = `<div class="empty-state">No cohort data available yet.</div>`;
    return;
  }
  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Vintage</th>
          <th>Loans</th>
          <th>Disbursed</th>
          <th>Current Outstanding</th>
          <th>Outstanding %</th>
          <th>Charge-offs</th>
          <th>Charge-off Amount</th>
          <th>CO Rate</th>
          <th>Signal</th>
        </tr>
      </thead>
      <tbody>
        ${cohorts.map((row) => {
          const coRisk = row.chargeoff_rate > 0.12 ? "error" : row.chargeoff_rate > 0.07 ? "warning" : "ok";
          return `
            <tr>
              <td><strong>${row.quarter}</strong></td>
              <td>${whole(row.originations)}</td>
              <td>${money(row.disbursed)}</td>
              <td>${money(row.current_outstanding)}</td>
              <td>${decimalRate(row.outstanding_ratio)}</td>
              <td>${whole(row.chargeoffs)}</td>
              <td>${money(row.chargeoff_amount)}</td>
              <td class="${coRisk === "error" ? "cell-error" : coRisk === "warning" ? "cell-warning" : ""}">${decimalRate(row.chargeoff_rate)}</td>
              <td><span class="tag ${coRisk}">${coRisk === "error" ? "High Risk" : coRisk === "warning" ? "Watch" : "OK"}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ── Partner efficiency table ───────────────────────────────────────────────────
function renderPartnerEfficiencyTable(data) {
  const efficiency = data.impact?.partner_efficiency || [];
  const agingByPartner = data.impact?.aging_by_partner || [];
  const maxDpd = new Map(agingByPartner.map((r) => [r.partner, r.max_days_past_due || 0]));
  const tbody = document.querySelector("#partner-efficiency-table tbody");
  if (!tbody) return;
  tbody.innerHTML = efficiency.map((row) => {
    const coRisk = row.chargeoff_rate > 0.12 ? "error" : row.chargeoff_rate > 0.07 ? "warning" : "ok";
    const dpd = maxDpd.get(row.partner) || 0;
    return `
      <tr>
        <td><strong>${row.partner}</strong></td>
        <td>${whole(row.originations)}</td>
        <td>${money(row.disbursed)}</td>
        <td>${money(row.avg_loan_size)}</td>
        <td class="${coRisk === "error" ? "cell-error" : coRisk === "warning" ? "cell-warning" : ""}">${decimalRate(row.chargeoff_rate)}</td>
        <td>${money(row.outstanding)}</td>
        <td>${decimalRate(row.outstanding_ratio)}</td>
        <td>${whole(row.jobs_per_million)}</td>
        <td class="${dpd > 90 ? "cell-warning" : ""}">${whole(dpd)}</td>
      </tr>
    `;
  }).join("");
}

// ── Geo gap table ─────────────────────────────────────────────────────────────
function renderGeoGapTable(data) {
  const target = document.querySelector("#geo-gap-table");
  if (!target) return;
  const crmStates = new Map((data.rds?.pre_screen_by_state || []).map((r) => [r.state, r.count]));
  const fundedStates = new Map((data.impact?.originations_by_state || []).map((r) => [r.state, { originations: r.originations, disbursed: r.disbursed }]));
  const allStates = new Set([...crmStates.keys(), ...fundedStates.keys()].filter((s) => s && s !== "(blank)" && s !== "UNKNOWN"));
  const rows = [...allStates].map((state) => ({
    state,
    crmDemand: crmStates.get(state) || 0,
    originations: fundedStates.get(state)?.originations || 0,
    disbursed: fundedStates.get(state)?.disbursed || 0,
    gap: (crmStates.get(state) || 0) > 0 && (fundedStates.get(state)?.originations || 0) === 0,
  })).sort((a, b) => b.crmDemand - a.crmDemand).slice(0, 20);
  target.innerHTML = `
    <table>
      <thead>
        <tr><th>State</th><th>CRM Demand</th><th>Funded Loans</th><th>Disbursed</th><th>Gap Signal</th></tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td><strong>${row.state}</strong></td>
            <td>${whole(row.crmDemand)}</td>
            <td>${whole(row.originations)}</td>
            <td>${money(row.disbursed)}</td>
            <td><span class="tag ${row.gap ? "warning" : row.originations === 0 ? "warning" : "ok"}">${row.gap ? "Demand / No Loans" : row.originations ? "Funded" : "No Activity"}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ── Analytics built-out panels ────────────────────────────────────────────────
function renderDemandGapAnalysis(data) {
  const target = document.querySelector("#demand-gap-analysis");
  if (!target) return;
  const crmByState = new Map((data.rds?.pre_screen_by_state || []).map((r) => [r.state, r.count]));
  const fundedByState = new Map((data.impact?.originations_by_state || []).map((r) => [r.state, r.disbursed]));
  const gaps = [...crmByState.entries()]
    .map(([state, demand]) => ({ state, demand, disbursed: fundedByState.get(state) || 0 }))
    .filter((r) => r.demand > 5 && !r.disbursed)
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 8);
  const underserved = [...crmByState.entries()]
    .map(([state, demand]) => ({ state, demand, disbursed: fundedByState.get(state) || 0 }))
    .filter((r) => r.demand > 10 && r.disbursed && r.demand / (r.disbursed / 100_000) > 5)
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 5);
  target.innerHTML = [
    ...(gaps.length ? [{ label: "States with demand but zero funded loans", detail: gaps.map((r) => `${r.state} (${whole(r.demand)} CRM records)`).join(" · ") }] : [{ label: "No zero-deployment demand states", detail: "All states with significant CRM demand have at least some funded loans." }]),
    ...(underserved.length ? [{ label: "Underserved relative demand", detail: underserved.map((r) => `${r.state}: ${whole(r.demand)} CRM vs ${money(r.disbursed)} deployed`).join(" · ") }] : []),
  ].map((row) => `
    <div class="insight-row warning">
      <strong>${row.label}</strong>
      <span>${row.detail}</span>
    </div>
  `).join("");
}

function renderPortfolioStressWatch(data) {
  const target = document.querySelector("#portfolio-stress-watch");
  if (!target) return;
  const derived = data.impact?.derived_kpis || {};
  const watch = data.impact?.ninety_plus_dpd_watch || [];
  const chargeoffsByQ = (data.impact?.chargeoffs_by_quarter || []).slice(-4);
  const avgRecentCo = chargeoffsByQ.length ? chargeoffsByQ.reduce((s, r) => s + r.chargeoff_amount, 0) / chargeoffsByQ.length : 0;
  const items = [
    { label: "30+ DPD Rate", status: derived.delinquency_rate_30_plus > 0.08 ? "warning" : "ok", detail: `${decimalRate(derived.delinquency_rate_30_plus)} — ${money(derived.delinquent_outstanding_30_plus)} outstanding` },
    { label: "60+ DPD Stress Rate", status: derived.stress_rate_60_plus > 0.05 ? "warning" : "ok", detail: `${decimalRate(derived.stress_rate_60_plus)} — ${money(derived.stress_outstanding_60_plus)} outstanding` },
    { label: "90+ DPD Partners", status: watch.length ? "warning" : "ok", detail: watch.length ? `${watch.length} partner(s) — ${money(watch.reduce((s, r) => s + r.outstanding, 0))} total 90+ DPD outstanding` : "No 90+ DPD balances reported" },
    { label: "Trailing 4Q Avg Charge-off / Quarter", status: avgRecentCo > 500_000 ? "warning" : "ok", detail: `${money(avgRecentCo)} average charge-off per quarter (last 4 quarters)` },
    { label: "Cumulative Charge-off Rate", status: derived.chargeoff_rate_on_disbursed > 0.08 ? "warning" : "ok", detail: `${decimalRate(derived.chargeoff_rate_on_disbursed)} of all deployed capital has been charged off` },
    { label: "Trailing 12M Charge-off Rate", status: derived.trailing_12m_chargeoff_rate > 0.06 ? "warning" : "ok", detail: `${decimalRate(derived.trailing_12m_chargeoff_rate)} of outstanding portfolio charged off in the last 12 months` },
  ];
  target.innerHTML = items.map((item) => `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${item.status}">${item.status}</span>${item.label}</div>
      <div class="quality-meta">${item.detail}</div>
    </div>
  `).join("");
}

function renderEfficiencyRanking(data) {
  const efficiency = data.impact?.partner_efficiency || [];
  renderBars("efficiency-ranking", efficiency.slice(0, 10).map((r) => ({ label: r.partner, jobs_per_million: r.jobs_per_million })), "jobs_per_million", whole, 12);
}

function renderEquityReach(data) {
  const target = document.querySelector("#equity-reach");
  if (!target) return;
  const derived = data.impact?.derived_kpis || {};
  const totals = data.impact?.totals || {};
  const items = [
    { label: "Minority-Owned Share", status: derived.minority_reported_share > 0.5 ? "ok" : "warning", detail: `${decimalRate(derived.minority_reported_share)} of originations report minority ownership (${whole(Math.round(derived.minority_reported_share * totals.originations))} of ${whole(totals.originations)} loans)` },
    { label: "Women-Owned Share", status: derived.women_reported_share > 0.3 ? "ok" : "warning", detail: `${decimalRate(derived.women_reported_share)} of originations report women-owned status` },
    { label: "LMI Borrower Share", status: derived.lmi_reported_share > 0.25 ? "ok" : "warning", detail: `${decimalRate(derived.lmi_reported_share)} of originations report Low-to-Moderate Income status` },
    { label: "Jobs per $1M Deployed", status: "ok", detail: `${whole(derived.jobs_per_million_deployed)} jobs reported per million dollars of capital deployed` },
    { label: "Average Loan Size", status: "ok", detail: `${money(derived.average_loan_size)} — compare to small-dollar (<$25K) share in Loan Size Distribution` },
  ];
  target.innerHTML = items.map((item) => `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${item.status}">${item.status}</span>${item.label}</div>
      <div class="quality-meta">${item.detail}</div>
    </div>
  `).join("");
}

// ── CRM Pipeline Waterfall ─────────────────────────────────────────────────────
function renderCrmPipelineWaterfall(data, rates, label = "") {
  const target = document.querySelector("#crm-pipeline-waterfall");
  if (!target) return;
  if (!rates.length) {
    target.innerHTML = `<div class="empty-state">No CRM funnel data available for ${label || "the selected date range"}.</div>`;
    return;
  }
  const totals = rates.reduce((acc, r) => {
    acc.total += r.total || 0;
    acc.approved += r.approved || 0;
    acc.in_progress += r.in_progress || 0;
    acc.denied += r.denied || 0;
    acc.discarded += r.discarded || 0;
    acc.unassigned += r.unassigned || 0;
    acc.sent_for_education += r.sent_for_education || 0;
    return acc;
  }, { total: 0, approved: 0, in_progress: 0, denied: 0, discarded: 0, unassigned: 0, sent_for_education: 0 });
  const liveOriginations = (data.impact?.totals?.originations) || 0;
  const steps = [
    { label: "PRE_SCREEN Applications", value: totals.total, pct: 1.0, tone: "ok", note: "All CDFIs, all statuses" },
    { label: "Active (Approved + In Progress)", value: totals.approved + totals.in_progress, pct: totals.total ? (totals.approved + totals.in_progress) / totals.total : 0, tone: "ok", note: `${whole(totals.approved)} approved + ${whole(totals.in_progress)} in progress` },
    { label: "Approved", value: totals.approved, pct: totals.total ? totals.approved / totals.total : 0, tone: totals.total && totals.approved / totals.total < 0.05 ? "warning" : "ok", note: `${decimalRate(totals.total ? totals.approved / totals.total : 0)} approval rate` },
    { label: "Unassigned (Backlog)", value: totals.unassigned, pct: totals.total ? totals.unassigned / totals.total : 0, tone: totals.total && totals.unassigned / totals.total > 0.25 ? "error" : "warning", note: `${decimalRate(totals.total ? totals.unassigned / totals.total : 0)} of pipeline stuck` },
    { label: "Denied", value: totals.denied, pct: totals.total ? totals.denied / totals.total : 0, tone: "neutral", note: `${decimalRate(totals.total ? totals.denied / totals.total : 0)} denial rate` },
    { label: "Discarded", value: totals.discarded, pct: totals.total ? totals.discarded / totals.total : 0, tone: "neutral", note: `${decimalRate(totals.total ? totals.discarded / totals.total : 0)} discard rate` },
    { label: "Live Data Originations (ITD)", value: liveOriginations, pct: null, tone: "ok", note: "From Live Data workbooks — broader scope than CRM window" },
  ];
  const maxVal = Math.max(...steps.map((s) => s.value), 1);
  target.innerHTML = steps.map((step) => {
    const barW = Math.max((step.value / maxVal) * 100, 2);
    return `
      <div class="waterfall-step ${step.tone}">
        <div class="waterfall-label">
          <span>${step.label}</span>
          <em>${step.note}</em>
        </div>
        <div class="waterfall-bar-track">
          <div class="waterfall-bar-fill ${step.tone}" style="width:${barW}%"></div>
        </div>
        <div class="waterfall-value">
          <strong>${whole(step.value)}</strong>
          ${step.pct !== null ? `<span>${decimalRate(step.pct)}</span>` : `<span>ITD</span>`}
        </div>
      </div>
    `;
  }).join("");
}

// ── State Market Penetration ──────────────────────────────────────────────────
function renderStatePenetration(data) {
  const target = document.querySelector("#state-penetration-table");
  if (!target) return;
  const crmByState = new Map((data.rds?.pre_screen_by_state || []).map((r) => [r.state, Number(r.count || 0)]));
  const fundedByState = new Map((data.impact?.originations_by_state || []).map((r) => [r.state, { loans: r.originations, disbursed: r.disbursed }]));
  const allStates = new Set([...crmByState.keys(), ...fundedByState.keys()].filter((s) => s && s !== "(blank)" && s !== "UNKNOWN" && s !== "Unknown"));
  const rows = [...allStates].map((state) => {
    const demand = crmByState.get(state) || 0;
    const funded = fundedByState.get(state) || { loans: 0, disbursed: 0 };
    const pen = demand > 0 ? funded.loans / demand : null;
    const signal = funded.loans === 0 && demand > 0 ? "gap" : pen !== null && pen < 0.25 ? "under" : pen !== null && pen > 2.0 ? "high" : "active";
    return { state, demand, loans: funded.loans, disbursed: funded.disbursed, penetration: pen, signal };
  }).sort((a, b) => b.demand - a.demand);

  const signalTag = { gap: "Demand Gap", under: "Under-Served", active: "Active", high: "High Conversion" };
  const signalTone = { gap: "error", under: "warning", active: "ok", high: "ok" };
  target.innerHTML = `
    <table>
      <thead>
        <tr><th>State</th><th>CRM Demand</th><th>Funded Loans</th><th>Disbursed</th><th>Penetration Rate</th><th>Signal</th></tr>
      </thead>
      <tbody>
        ${rows.slice(0, 25).map((r) => `
          <tr>
            <td><strong>${r.state}</strong></td>
            <td>${whole(r.demand)}</td>
            <td>${whole(r.loans)}</td>
            <td>${money(r.disbursed)}</td>
            <td class="${r.signal === "gap" || r.signal === "under" ? "cell-warning" : ""}">${r.penetration !== null ? decimalRate(r.penetration) : "–"}</td>
            <td><span class="tag ${signalTone[r.signal]}">${signalTag[r.signal]}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ── Quarterly Charge-off Trend ────────────────────────────────────────────────
function renderChargeoffTrend(data) {
  const target = document.querySelector("#chargeoff-quarterly-trend");
  if (!target) return;
  const coQ = (data.impact?.chargeoffs_by_quarter || []).filter((r) => r.quarter !== "Unknown");
  const origQ = new Map((data.impact?.originations_by_quarter || []).map((r) => [r.quarter, r.disbursed]));
  if (!coQ.length) { target.innerHTML = `<div class="empty-state">No quarterly charge-off data.</div>`; return; }
  const width = 820, height = 280, pad = 44, rightPad = 60;
  const maxAmt = Math.max(...coQ.map((r) => r.chargeoff_amount), 1);
  const maxRate = Math.max(...coQ.map((r) => origQ.get(r.quarter) ? r.chargeoff_amount / origQ.get(r.quarter) : 0), 0.001);
  const step = coQ.length > 1 ? (width - pad - rightPad) / (coQ.length - 1) : 1;
  const barW = Math.max(step * 0.55, 4);
  const bars = coQ.map((r, i) => {
    const x = pad + i * step;
    const h = (r.chargeoff_amount / maxAmt) * (height - pad * 2);
    const tone = r.chargeoff_amount > 200_000 ? "#dc2626" : r.chargeoff_amount > 100_000 ? "#f59e0b" : "#075aa6";
    return `<rect x="${x - barW / 2}" y="${height - pad - h}" width="${barW}" height="${h}" fill="${tone}" opacity="0.82" rx="2"><title>${r.quarter}: ${money(r.chargeoff_amount)} (${r.chargeoffs} charge-offs)</title></rect>`;
  });
  const ratePoints = coQ.map((r, i) => {
    const x = pad + i * step;
    const rawRate = origQ.get(r.quarter) ? r.chargeoff_amount / origQ.get(r.quarter) : 0;
    const y = height - pad - (rawRate / maxRate) * (height - pad * 2);
    return { x, y, r, rawRate };
  });
  const ratePath = ratePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const showEveryN = Math.ceil(coQ.length / 8);
  target.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Quarterly charge-off trend">
      <line x1="${pad}" y1="${height - pad}" x2="${width - rightPad}" y2="${height - pad}" stroke="#dfe5ee"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#dfe5ee"/>
      ${bars.join("")}
      <path d="${ratePath}" fill="none" stroke="#c9dc21" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="5,3"/>
      ${ratePoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#c9dc21" stroke="#075aa6" stroke-width="1.5"><title>${p.r.quarter} CO rate on quarterly disbursed: ${decimalRate(p.rawRate)}</title></circle>`).join("")}
      ${coQ.filter((_, i) => i % showEveryN === 0 || i === coQ.length - 1).map((r, idx) => {
        const i = coQ.indexOf(r);
        return `<text x="${pad + i * step}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#637083">${r.quarter}</text>`;
      }).join("")}
      <text x="${pad - 4}" y="${pad}" text-anchor="end" font-size="10" fill="#637083">$</text>
      <text x="${width - rightPad + 6}" y="${pad}" font-size="10" fill="#c9dc21">rate</text>
    </svg>
    <div style="font-size:11px;color:#637083;padding:4px 8px;">Bars = charge-off $ (red &gt;$200K, amber &gt;$100K). Dashed line = quarterly CO rate on disbursed (right axis).</div>
  `;
}

// ── Portfolio Runoff Projection ───────────────────────────────────────────────
function renderRunoffProjection(data) {
  const target = document.querySelector("#runoff-projection");
  if (!target) return;
  const recycling = data.impact?.capital_recycling || {};
  const mo = data.impact?.monthly_originations || [];
  if (!recycling.total_disbursed) { target.innerHTML = `<div class="empty-state">Insufficient data for projection.</div>`; return; }
  // Estimate quarterly repayment run rate from trailing 4 quarters of implied repaid
  // implied_repaid = disbursed - outstanding - chargeoffs (all-time)
  // Approximate quarterly repayment: use implied_repaid / active quarters
  const activeMonths = mo.length || 1;
  const activeQuarters = activeMonths / 3;
  const quarterlyRepayment = recycling.implied_repaid / activeQuarters;
  const quarterlyChargeoff = recycling.chargeoff_amount / activeQuarters;
  const scenarios = [
    { label: "Current", q: 0, note: "Today's balance" },
    { label: "+4 Quarters (1 yr)", q: 4, note: "At current repayment pace" },
    { label: "+8 Quarters (2 yr)", q: 8, note: "Assuming pace holds" },
    { label: "+12 Quarters (3 yr)", q: 12, note: "Long-range estimate" },
  ];
  target.innerHTML = scenarios.map((sc) => {
    const proj = Math.max(recycling.outstanding - sc.q * quarterlyRepayment, 0);
    const projCo = Math.min(recycling.chargeoff_amount + sc.q * quarterlyChargeoff, recycling.total_disbursed);
    const tone = proj < recycling.outstanding * 0.4 ? "ok" : "neutral";
    return `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${tone}">${sc.label}</span>${sc.note}</div>
        <div class="quality-meta">Outstanding: ${money(proj)} | Cumulative CO (est.): ${money(projCo)}</div>
      </div>
    `;
  }).join("") + `<div class="quality-item"><div class="quality-meta" style="font-size:11px;color:#637083">Quarterly repayment rate: ${money(quarterlyRepayment)}/quarter (implied). Projection assumes constant pace — actual will vary.</div></div>`;
}

// ── Data Field Completeness ───────────────────────────────────────────────────
function renderDataCompleteness(data) {
  const target = document.querySelector("#data-completeness-table");
  if (!target) return;
  const rows = data.impact?.partner_data_quality || [];
  if (!rows.length) { target.innerHTML = `<div class="empty-state">No completeness data available.</div>`; return; }
  const cellClass = (rate) => rate >= 0.9 ? "cell-ok" : rate >= 0.6 ? "cell-warn-soft" : "cell-warning";
  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Partner</th>
          <th>Origination Rows</th>
          <th>State Fill %</th>
          <th>Jobs Fill %</th>
          <th>Demographics</th>
          <th>Overall Signal</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => {
          const overall = r.state_fill_rate >= 0.9 && r.jobs_fill_rate >= 0.5 ? "ok" : r.state_fill_rate < 0.6 ? "error" : "warning";
          return `
            <tr>
              <td><strong>${r.partner}</strong></td>
              <td>${whole(r.total_rows)}</td>
              <td class="${cellClass(r.state_fill_rate)}">${decimalRate(r.state_fill_rate)}</td>
              <td class="${cellClass(r.jobs_fill_rate)}">${decimalRate(r.jobs_fill_rate)}</td>
              <td><span class="tag ${r.has_demographics ? "ok" : "warning"}">${r.has_demographics ? "Present" : "Missing"}</span></td>
              <td><span class="tag ${overall}">${overall === "ok" ? "Complete" : overall === "warning" ? "Gaps" : "Poor"}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ── Rolling 12-Month Originations ─────────────────────────────────────────────
function renderRolling12m(data) {
  const target = document.querySelector("#monthly-originations-trend");
  if (!target) return;
  const rows = data.impact?.rolling_12m_originations || data.impact?.monthly_originations || [];
  const cleanRows = rows.filter((r) => r.month && r.month !== "Unknown");
  if (!cleanRows.length) { target.innerHTML = `<div class="empty-state">No monthly data available.</div>`; return; }
  const width = 820, height = 240, pad = 36;
  const maxMonthly = Math.max(...cleanRows.map((r) => r.originations || 0), 1);
  const maxRolling = Math.max(...cleanRows.map((r) => r.rolling_12m_originations || 0), 1);
  const scaleRolling = maxMonthly / maxRolling; // normalize rolling to same visual scale
  const step = cleanRows.length > 1 ? (width - pad * 2) / (cleanRows.length - 1) : 1;
  const barW = Math.max(step * 0.6, 2);
  const rollingPoints = cleanRows.map((r, i) => ({
    x: pad + i * step,
    y: height - pad - ((r.rolling_12m_originations || 0) * scaleRolling / maxMonthly) * (height - pad * 2),
    r,
  }));
  const rollingPath = rollingPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const showEveryN = Math.ceil(cleanRows.length / 12);
  target.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly originations with rolling 12-month trend">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#dfe5ee"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#dfe5ee"/>
      ${cleanRows.map((r, i) => {
        const x = pad + i * step;
        const h = ((r.originations || 0) / maxMonthly) * (height - pad * 2);
        return `<rect x="${x - barW / 2}" y="${height - pad - h}" width="${barW}" height="${h}" fill="#075aa6" opacity="0.35" rx="1"><title>${String(r.month || "").slice(0, 7)}: ${whole(r.originations)} originations</title></rect>`;
      }).join("")}
      <path d="${rollingPath}" fill="none" stroke="#c9dc21" stroke-width="2.5" stroke-linecap="round"/>
      ${rollingPoints.filter((_, i) => i % showEveryN === 0 || i === rollingPoints.length - 1).map((p) => `<text x="${p.x}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#637083">${String(p.r.month || "").slice(0, 7)}</text>`).join("")}
    </svg>
    <div style="font-size:11px;color:#637083;padding:4px 8px;">Blue bars = monthly origination count. Yellow line = rolling 12-month sum (scaled).</div>
  `;
}

// ── Geography CRM Disclaimer ──────────────────────────────────────────────────
// (disclaimer rendered inline in HTML; this function updates the note dynamically)
function renderGeoCrmNote(data) {
  const el = document.querySelector("#geo-crm-disclaimer");
  if (!el) return;
  const totalLoans = data.impact?.totals?.originations || 0;
  const crmTotal = (data.rds?.pre_screen_by_state || []).reduce((s, r) => s + Number(r.count || 0), 0);
  if (totalLoans && crmTotal) {
    const ratio = Math.round((crmTotal / totalLoans) * 100);
    const noteEl = el.querySelector("p");
    if (noteEl) noteEl.textContent += ` (${whole(crmTotal)} CRM pre-screen records vs ${whole(totalLoans)} total funded loans — approximately ${ratio}% overlap at most.)`;
  }
}

// ── RDS Stale Data Banner (Funnel + Geography) ────────────────────────────────
function renderRdsStaleBanner(data) {
  const rds = data.rds || {};
  const isStale = rds.refresh_status === "stale_snapshot" || rds.refresh_status === "error" || rds.refresh_status === "cache_only";
  const lastGood = rds.last_successful_refresh_at ? `Last successful RDS pull: ${shortDate(rds.last_successful_refresh_at)}.` : "No successful RDS pull recorded.";
  const bannerHTML = isStale
    ? `<div class="crm-disclaimer-banner" style="border-left-color:var(--gold-500);">
        <div class="crm-disclaimer-icon">&#9888;</div>
        <div class="crm-disclaimer-body">
          <strong>CRM data is from a cached snapshot — not today's live RDS</strong>
          <p>${lastGood} This typically means the machine is on corporate VPN, which blocks the SSH tunnel to the AWS bastion. CRM counts, pipeline status, and funnel rates on this page reflect the prior successful refresh — not current live data. Switch to hotspot and re-run refresh to get live CRM data.</p>
        </div>
      </div>`
    : "";
  const funnelEl = document.querySelector("#rds-stale-funnel");
  if (funnelEl) funnelEl.innerHTML = bannerHTML;
  const geoEl = document.querySelector("#rds-stale-geo");
  if (geoEl) geoEl.innerHTML = bannerHTML;
}

// ── Funnel Risk Flags ─────────────────────────────────────────────────────────
function renderFunnelRiskFlags(data) {
  const target = document.querySelector("#funnel-risk-flags");
  if (!target) return;
  const rates = data.crm_funnel_rates || [];
  const rds = data.rds || {};
  const totals = rates.reduce((acc, r) => {
    acc.total += r.total || 0;
    acc.unassigned += r.unassigned || 0;
    acc.denied += r.denied || 0;
    acc.discarded += r.discarded || 0;
    acc.approved += r.approved || 0;
    return acc;
  }, { total: 0, unassigned: 0, denied: 0, discarded: 0, approved: 0 });
  const flags = [];
  if (totals.total > 0) {
    const unassignedPct = totals.unassigned / totals.total;
    if (unassignedPct > 0.25) flags.push({ status: "error", label: "High Unassigned Backlog", detail: `${decimalRate(unassignedPct)} of PRE_SCREEN (${whole(totals.unassigned)} records) are unassigned — stalled pipeline risk` });
    else if (unassignedPct > 0.1) flags.push({ status: "warning", label: "Elevated Unassigned Rate", detail: `${decimalRate(unassignedPct)} unassigned (${whole(totals.unassigned)} records)` });
    const discardedPct = totals.discarded / totals.total;
    if (discardedPct > 0.35) flags.push({ status: "warning", label: "High Discard Rate", detail: `${decimalRate(discardedPct)} of applications discarded — check for pipeline friction or eligibility mismatch` });
    const approvalPct = totals.approved / totals.total;
    if (approvalPct < 0.05) flags.push({ status: "warning", label: "Very Low Approval Rate", detail: `Only ${decimalRate(approvalPct)} of PRE_SCREEN records are approved — may indicate funnel quality issues` });
  }
  // Per-CDFI high unassigned
  rates.forEach((r) => {
    if (r.total > 10 && r.unassigned / r.total > 0.4) {
      flags.push({ status: "warning", label: `${r.cdfi || r.partner}: High Unassigned`, detail: `${whole(r.unassigned)} of ${whole(r.total)} records unassigned (${decimalRate(r.unassigned / r.total)})` });
    }
  });
  if (!flags.length) flags.push({ status: "ok", label: "No Critical Funnel Flags", detail: "Unassigned rate, approval rate, and discard rate are all within acceptable ranges." });
  target.innerHTML = flags.map((f) => `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${f.status}">${f.status}</span>${f.label}</div>
      <div class="quality-meta">${f.detail}</div>
    </div>
  `).join("");
}

// ── Velocity Forecast Chart ───────────────────────────────────────────────────
function renderVelocityForecast(data) {
  const target = document.querySelector("#velocity-forecast-chart");
  if (!target) return;
  const byQ = (data.impact?.originations_by_quarter || []).filter((r) => r.quarter && r.quarter !== "Unknown");
  if (byQ.length < 4) { target.innerHTML = `<div class="empty-state">Need at least 4 quarters of data for forecast.</div>`; return; }
  // Simple linear regression on index → count
  const n = byQ.length;
  const xs = byQ.map((_, i) => i);
  const ys = byQ.map((r) => r.originations || 0);
  const sumX = xs.reduce((s, v) => s + v, 0);
  const sumY = ys.reduce((s, v) => s + v, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const forecast = [n, n + 1].map((xi, j) => ({
    quarter: `Forecast +${j + 1}Q`,
    originations: Math.max(0, Math.round(intercept + slope * xi)),
    projected: true,
  }));
  const velocity = data.impact?.origination_velocity || {};
  const signal = velocity.signal || "stable";
  const allRows = [...byQ.slice(-8), ...forecast];
  const width = 820, height = 260, pad = 40;
  const maxVal = Math.max(...allRows.map((r) => r.originations || 0), 1);
  const step = allRows.length > 1 ? (width - pad * 2) / (allRows.length - 1) : 1;
  const barW = Math.max(step * 0.5, 6);
  const signalColor = { growing: "#22c55e", stable: "#3b82f6", declining: "#f59e0b", sharp_decline: "#ef4444" }[signal] || "#3b82f6";
  target.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Velocity forecast">
      <defs>
        <pattern id="forecast-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(212,152,42,0.3)" stroke-width="2"/>
        </pattern>
      </defs>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="rgba(255,255,255,0.06)"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="rgba(255,255,255,0.06)"/>
      ${allRows.map((r, i) => {
        const x = pad + i * step;
        const h = ((r.originations || 0) / maxVal) * (height - pad * 2);
        const fill = r.projected ? "url(#forecast-hatch)" : "#075aa6";
        const opacity = r.projected ? 0.8 : 0.75;
        return `<rect x="${x - barW / 2}" y="${height - pad - h}" width="${barW}" height="${h}" fill="${fill}" opacity="${opacity}" rx="3">
          <title>${r.quarter}: ${whole(r.originations)} originations${r.projected ? " (projected)" : ""}</title>
        </rect>`;
      }).join("")}
      ${allRows.map((_, i) => {
        const x = pad + i * step;
        const y = height - pad - ((intercept + slope * i) / maxVal) * (height - pad * 2);
        return `${i === 0 ? `<path d="M ${x} ${y}` : `L ${x} ${y}`}`;
      }).join(" ")}"/>
      <text x="${pad + (n - 0.5) * step}" y="${pad + 16}" text-anchor="middle" font-size="10" fill="rgba(212,152,42,0.8)">Projected</text>
      <line x1="${pad + n * step - step / 2}" y1="${pad}" x2="${pad + n * step - step / 2}" y2="${height - pad}" stroke="rgba(212,152,42,0.3)" stroke-dasharray="4,3"/>
      ${allRows.map((r, i) => `<text x="${pad + i * step}" y="${height - 8}" text-anchor="middle" font-size="10" fill="${r.projected ? "rgba(212,152,42,0.8)" : "rgba(255,255,255,0.35)"}">${String(r.quarter).replace("Forecast ", "→")}</text>`).join("")}
    </svg>
    <div style="font-size:11px;color:var(--text-tertiary);padding:6px 0 0;">Signal: <strong style="color:${signalColor}">${signal.replace("_", " ")}</strong>. Hatched bars are 2-quarter linear regression projection. Regression slope: ${slope > 0 ? "+" : ""}${slope.toFixed(1)} loans/quarter.</div>
  `;
}

// ── Rolling 12-Month Comparison ───────────────────────────────────────────────
function renderRolling12mCompare(data) {
  const target = document.querySelector("#rolling-12m-compare");
  if (!target) return;
  const cmp = data.impact?.rolling_12m_comparison;
  const monthly = data.impact?.monthly_originations || [];
  // Compute from monthly if backend key not present
  let curr12 = 0, prior12 = 0, currDisbursed = 0, priorDisbursed = 0;
  if (cmp) {
    curr12 = cmp.current_12m_originations || 0;
    prior12 = cmp.prior_12m_originations || 0;
    currDisbursed = cmp.current_12m_disbursed || 0;
    priorDisbursed = cmp.prior_12m_disbursed || 0;
  } else if (monthly.length >= 12) {
    const sorted = [...monthly].sort((a, b) => String(a.month).localeCompare(String(b.month)));
    const recent24 = sorted.slice(-24);
    const recent12 = recent24.slice(-12);
    const prev12 = recent24.slice(0, 12);
    curr12 = recent12.reduce((s, r) => s + (r.originations || 0), 0);
    prior12 = prev12.reduce((s, r) => s + (r.originations || 0), 0);
    currDisbursed = recent12.reduce((s, r) => s + (r.disbursed || 0), 0);
    priorDisbursed = prev12.reduce((s, r) => s + (r.disbursed || 0), 0);
  }
  if (!curr12 && !prior12) { target.innerHTML = `<div class="empty-state">Insufficient monthly history for 12-month comparison.</div>`; return; }
  const origChange = prior12 ? ((curr12 - prior12) / prior12) * 100 : null;
  const disbChange = priorDisbursed ? ((currDisbursed - priorDisbursed) / priorDisbursed) * 100 : null;
  const items = [
    { label: "Originations — Last 12 Months", current: whole(curr12), prior: whole(prior12), change: origChange, unit: "loans" },
    { label: "Capital Disbursed — Last 12 Months", current: money(currDisbursed), prior: money(priorDisbursed), change: disbChange, unit: "disbursed" },
  ];
  target.innerHTML = items.map((item) => {
    const up = item.change !== null && item.change > 0;
    const sign = up ? "▲" : "▼";
    const tone = up ? "ok" : item.change !== null && item.change < -10 ? "error" : "warning";
    return `
      <div class="quality-item">
        <div class="quality-title">${item.label}</div>
        <div class="quality-meta" style="display:flex;gap:24px;align-items:center;padding-top:4px;">
          <div><span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Current 12M</span><br><strong style="font-size:1.3rem;color:var(--text-primary);font-variant-numeric:tabular-nums;">${item.current}</strong></div>
          <div><span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Prior 12M</span><br><strong style="font-size:1.1rem;color:var(--text-secondary);font-variant-numeric:tabular-nums;">${item.prior}</strong></div>
          ${item.change !== null ? `<div><span class="tag ${tone}">${sign} ${Math.abs(item.change).toFixed(1)}%</span></div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// ── Seasonal Origination Chart ────────────────────────────────────────────────
function renderSeasonalChart(data) {
  const target = document.querySelector("#seasonal-chart");
  if (!target) return;
  const byQ = (data.impact?.originations_by_quarter || []).filter((r) => r.quarter && r.quarter !== "Unknown");
  if (!byQ.length) { target.innerHTML = `<div class="empty-state">No quarterly data.</div>`; return; }
  // Group by calendar quarter (Q1, Q2, Q3, Q4) across years
  const buckets = { Q1: [], Q2: [], Q3: [], Q4: [] };
  byQ.forEach((r) => {
    const qLabel = String(r.quarter).slice(-2); // e.g. "Q1"
    if (buckets[qLabel]) buckets[qLabel].push(r.originations || 0);
  });
  const avgs = Object.entries(buckets).map(([q, vals]) => ({
    label: q,
    avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
    count: vals.length,
  }));
  const maxAvg = Math.max(...avgs.map((r) => r.avg), 1);
  target.innerHTML = `
    <div class="bar-list" style="padding:8px 0;">
      ${avgs.map((r) => `
        <div class="bar-row">
          <div class="bar-row-header">
            <span class="bar-label">${r.label} <em>(${r.count} yr avg)</em></span>
            <span class="bar-value">${r.avg.toFixed(1)} loans/qtr</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${(r.avg / maxAvg * 100).toFixed(1)}%"></div></div>
        </div>
      `).join("")}
    </div>
    <div style="font-size:11px;color:var(--text-tertiary);padding-top:4px;">Average originations per calendar quarter across all years in data.</div>
  `;
}

// ── Demand-Supply Lag Chart ───────────────────────────────────────────────────
function renderDemandSupplyLag(data) {
  const target = document.querySelector("#demand-supply-lag-chart");
  if (!target) return;
  // Use backend key if available, else approximate from monthly_pre_screen_volume + monthly_originations
  const lag = data.demand_supply_lag;
  const monthly = data.monthly_originations || data.rds?.monthly_pre_screen_demand || [];
  const origMonthly = data.impact?.monthly_originations || [];
  if (!origMonthly.length) { target.innerHTML = `<div class="empty-state">No monthly origination data for lag analysis.</div>`; return; }
  // Build month→count maps
  const origMap = new Map(origMonthly.map((r) => [String(r.month || "").slice(0, 7), r.originations || 0]));
  const crmMonthly = data.monthly_pre_screen_volume || [];
  if (!crmMonthly.length) { target.innerHTML = `<div class="empty-state">No monthly CRM demand data for lag analysis.</div>`; return; }
  const crmMap = new Map(crmMonthly.map((r) => [String(r.month || "").slice(0, 7), r.count || 0]));
  // Align: for each CRM month, show originations at T+0, T+3, T+6
  const months = [...crmMap.keys()].sort().slice(-18);
  const maxVal = Math.max(
    ...months.map((m) => crmMap.get(m) || 0),
    ...months.map((m) => origMap.get(m) || 0),
    1
  );
  const width = 820, height = 240, pad = 40;
  const step = months.length > 1 ? (width - pad * 2) / (months.length - 1) : 1;
  const crmPoints = months.map((m, i) => ({ x: pad + i * step, y: height - pad - ((crmMap.get(m) || 0) / maxVal) * (height - pad * 2), v: crmMap.get(m) || 0, m }));
  const origPoints = months.map((m, i) => ({ x: pad + i * step, y: height - pad - ((origMap.get(m) || 0) / maxVal) * (height - pad * 2), v: origMap.get(m) || 0, m }));
  const crmPath = crmPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const origPath = origPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const showEvery = Math.ceil(months.length / 8);
  target.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Demand-supply lag">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="rgba(255,255,255,0.06)"/>
      <path d="${crmPath}" fill="none" stroke="rgba(245,158,11,0.8)" stroke-width="2" stroke-dasharray="5,3"/>
      <path d="${origPath}" fill="none" stroke="rgba(59,130,246,0.9)" stroke-width="2"/>
      ${months.filter((_, i) => i % showEvery === 0 || i === months.length - 1).map((m, _, arr) => {
        const i = months.indexOf(m);
        return `<text x="${pad + i * step}" y="${height - 8}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.35)">${String(m).slice(0, 7)}</text>`;
      }).join("")}
    </svg>
    <div style="font-size:11px;color:var(--text-tertiary);padding-top:6px;">
      <span style="color:rgba(245,158,11,0.9);">——</span> CRM PRE_SCREEN demand &nbsp;
      <span style="color:rgba(59,130,246,0.9);">——</span> Originations (Live Data)<br>
      CRM-to-loan lag is typically 3–6 months; most loans originate outside the CRM portal.
    </div>
  `;
}

// ── Cost Per Job ──────────────────────────────────────────────────────────────
function renderCostPerJob(data) {
  const target = document.querySelector("#cost-per-job");
  if (!target) return;
  const ads = data.google_ads || {};
  const totalJobs = data.impact?.totals?.jobs || 0;
  const totalLoans = data.impact?.totals?.originations || 0;
  const totalDisbursed = data.impact?.totals?.disbursed || 0;
  const adCost = ads.totals?.cost || 0;
  const items = [];
  if (totalJobs && totalDisbursed) {
    items.push({ label: "Capital Cost per Job (Deployed / Jobs)", value: money(totalDisbursed / totalJobs), status: "ok", detail: `${money(totalDisbursed)} deployed / ${whole(totalJobs)} jobs` });
  }
  if (adCost && totalJobs) {
    items.push({ label: "Ad Spend per Job (Directional)", value: money(adCost / totalJobs), status: "neutral", detail: `${money(adCost)} ad spend / ${whole(totalJobs)} total jobs — directional only; most loans not from ads` });
  }
  if (adCost && totalLoans) {
    items.push({ label: "Ad Spend per Funded Loan (Directional)", value: money(adCost / totalLoans), status: "neutral", detail: `${money(adCost)} ad spend / ${whole(totalLoans)} total originations — directional; CRM loans are a subset` });
  }
  const crmConversions = ads.totals?.conversions || 0;
  if (adCost && crmConversions) {
    items.push({ label: "Ad Spend per CRM Conversion Event", value: money(adCost / crmConversions), status: "ok", detail: `${money(adCost)} / ${whole(crmConversions)} conversion events (Google Ads data)` });
  }
  if (!items.length) {
    target.innerHTML = `<div class="empty-state">Google Ads cost data not available — configure Google Ads API to enable cost-per-job analysis.</div>`;
    return;
  }
  target.innerHTML = items.map((item) => `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${item.status}">${item.status}</span>${item.label}</div>
      <div class="quality-meta" style="display:flex;gap:16px;align-items:center;">
        <strong style="font-size:1.4rem;color:var(--text-primary);font-variant-numeric:tabular-nums;">${item.value}</strong>
        <span>${item.detail}</span>
      </div>
    </div>
  `).join("");
}

// ── Partner DSO Table ─────────────────────────────────────────────────────────
function renderPartnerDsoTable(data) {
  const tbody = document.querySelector("#partner-dso-table tbody");
  if (!tbody) return;
  const efficiency = data.impact?.partner_efficiency || [];
  const totals30dpd = efficiency.reduce((s, r) => s + (r.delinquent_outstanding || r.outstanding_30_plus || 0), 0);
  const rows = efficiency.map((r) => {
    const disbursed = r.disbursed || 0;
    const outstanding = r.outstanding || 0;
    const dso = disbursed > 0 ? (outstanding / disbursed) * 12 : null;
    const deliq = r.delinquent_outstanding || r.outstanding_30_plus || 0;
    const deliqShare = totals30dpd > 0 ? deliq / totals30dpd : 0;
    const signal = dso !== null && dso > 10 ? "warning" : dso !== null && dso < 4 ? "ok" : "neutral";
    return { partner: r.partner, dso, deliq, deliqShare, signal };
  }).sort((a, b) => (b.dso || 0) - (a.dso || 0));
  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td><strong>${r.partner}</strong></td>
      <td class="${r.dso !== null && r.dso > 10 ? "cell-warning" : ""}">${r.dso !== null ? r.dso.toFixed(1) : "–"}</td>
      <td>${r.deliq ? money(r.deliq) : "–"}</td>
      <td class="${r.deliqShare > 0.3 ? "cell-warning" : ""}">${r.deliqShare ? decimalRate(r.deliqShare) : "–"}</td>
      <td><span class="tag ${r.signal}">${r.signal}</span></td>
    </tr>
  `).join("");
}

// ── Partner Growth Chart ──────────────────────────────────────────────────────
function renderPartnerGrowthChart(data) {
  const target = document.querySelector("#partner-growth-chart");
  if (!target) return;
  const byPQ = data.impact?.originations_by_partner_quarter;
  const byQ = data.impact?.originations_by_quarter || [];
  if (!byQ.length) { target.innerHTML = `<div class="empty-state">No quarterly data available.</div>`; return; }
  // Fall back to per-partner totals with trend arrows if no partner×quarter breakdown
  const partners = (data.impact?.originations_by_partner || []).slice(0, 8);
  const efficiency = data.impact?.partner_efficiency || [];
  const effMap = new Map(efficiency.map((r) => [r.partner, r]));
  if (!partners.length) { target.innerHTML = `<div class="empty-state">No partner data available.</div>`; return; }
  const maxDisbursed = Math.max(...partners.map((r) => r.disbursed || 0), 1);
  target.innerHTML = `
    <div class="bar-list" style="padding:8px 0;">
      ${partners.map((r) => {
        const eff = effMap.get(r.partner);
        const coRate = eff?.chargeoff_rate || 0;
        const tone = coRate > 0.1 ? "red" : coRate > 0.05 ? "" : "green";
        return `
          <div class="bar-row">
            <div class="bar-row-header">
              <span class="bar-label">${r.partner}</span>
              <span class="bar-value">${whole(r.originations)} loans · ${money(r.disbursed)}</span>
            </div>
            <div class="bar-track"><div class="bar-fill ${tone}" style="width:${(r.disbursed / maxDisbursed * 100).toFixed(1)}%"></div></div>
            ${eff ? `<div style="font-size:10.5px;color:var(--text-tertiary);padding-top:2px;">CO rate: ${decimalRate(coRate)} · Avg loan: ${money(eff.avg_loan_size)} · Jobs/$1M: ${whole(eff.jobs_per_million)}</div>` : ""}
          </div>
        `;
      }).join("")}
    </div>
    <div style="font-size:11px;color:var(--text-tertiary);padding-top:4px;">Green = CO rate ≤5%, red = CO rate &gt;10%. ITD figures.</div>
  `;
}

// ── Partner 4-Quadrant Matrix ─────────────────────────────────────────────────
function renderPartnerMatrix(data) {
  const target = document.querySelector("#partner-matrix-chart");
  const tooltip = document.querySelector("#partner-matrix-tooltip");
  if (!target) return;
  const efficiency = data.impact?.partner_efficiency || [];
  if (efficiency.length < 2) { target.innerHTML = `<div class="empty-state">Need at least 2 partners for scatter plot.</div>`; return; }
  const width = 820, height = 380, padL = 56, padB = 48, padT = 24, padR = 20;
  const maxLoans = Math.max(...efficiency.map((r) => r.originations || 0), 1);
  const maxRate = Math.max(...efficiency.map((r) => r.chargeoff_rate || 0), 0.01);
  const maxOut = Math.max(...efficiency.map((r) => r.outstanding || 0), 1);
  const medLoans = efficiency.reduce((s, r) => s + (r.originations || 0), 0) / efficiency.length;
  const medRate = efficiency.reduce((s, r) => s + (r.chargeoff_rate || 0), 0) / efficiency.length;
  const toX = (loans) => padL + (loans / maxLoans) * (width - padL - padR);
  const toY = (rate) => height - padB - (rate / maxRate) * (height - padT - padB);
  const medX = toX(medLoans);
  const medY = toY(medRate);
  const dots = efficiency.map((r) => {
    const x = toX(r.originations || 0);
    const y = toY(r.chargeoff_rate || 0);
    const r2 = Math.max(8, Math.min(28, Math.sqrt((r.outstanding || 0) / maxOut) * 28));
    const quadrant = (r.originations || 0) >= medLoans && (r.chargeoff_rate || 0) <= medRate ? "stars"
      : (r.originations || 0) < medLoans && (r.chargeoff_rate || 0) <= medRate ? "growing"
      : (r.originations || 0) >= medLoans && (r.chargeoff_rate || 0) > medRate ? "watch"
      : "concern";
    const color = { stars: "#22c55e", growing: "#3b82f6", watch: "#f59e0b", concern: "#ef4444" }[quadrant];
    return { ...r, x, y, r2, quadrant, color };
  });
  target.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Partner 4-quadrant matrix" style="cursor:crosshair;">
      <!-- Quadrant backgrounds -->
      <rect x="${padL}" y="${padT}" width="${medX - padL}" height="${medY - padT}" fill="rgba(59,130,246,0.04)"/>
      <rect x="${medX}" y="${padT}" width="${width - medX - padR}" height="${medY - padT}" fill="rgba(34,197,94,0.04)"/>
      <rect x="${padL}" y="${medY}" width="${medX - padL}" height="${height - padB - medY}" fill="rgba(239,68,68,0.04)"/>
      <rect x="${medX}" y="${medY}" width="${width - medX - padR}" height="${height - padB - medY}" fill="rgba(245,158,11,0.04)"/>
      <!-- Median lines -->
      <line x1="${medX}" y1="${padT}" x2="${medX}" y2="${height - padB}" stroke="rgba(255,255,255,0.12)" stroke-dasharray="4,3"/>
      <line x1="${padL}" y1="${medY}" x2="${width - padR}" y2="${medY}" stroke="rgba(255,255,255,0.12)" stroke-dasharray="4,3"/>
      <!-- Quadrant labels -->
      <text x="${padL + 8}" y="${padT + 16}" font-size="10" fill="rgba(59,130,246,0.7)">Growing</text>
      <text x="${medX + 8}" y="${padT + 16}" font-size="10" fill="rgba(34,197,94,0.7)">Stars</text>
      <text x="${padL + 8}" y="${height - padB - 8}" font-size="10" fill="rgba(239,68,68,0.7)">Concern</text>
      <text x="${medX + 8}" y="${height - padB - 8}" font-size="10" fill="rgba(245,158,11,0.7)">Watch</text>
      <!-- Axes -->
      <line x1="${padL}" y1="${height - padB}" x2="${width - padR}" y2="${height - padB}" stroke="rgba(255,255,255,0.1)"/>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${height - padB}" stroke="rgba(255,255,255,0.1)"/>
      <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.4)">Volume (loans originated)</text>
      <text x="12" y="${height / 2}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.4)" transform="rotate(-90 12 ${height / 2})">Charge-off Rate</text>
      <!-- Dots -->
      ${dots.map((d) => `
        <circle cx="${d.x}" cy="${d.y}" r="${d.r2}" fill="${d.color}" opacity="0.7" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" class="partner-dot" data-partner="${d.partner}" data-loans="${d.originations}" data-rate="${d.chargeoff_rate}" data-quadrant="${d.quadrant}">
          <title>${d.partner} · ${whole(d.originations)} loans · CO rate ${decimalRate(d.chargeoff_rate)} · Outstanding ${money(d.outstanding)}</title>
        </circle>
        <text x="${d.x}" y="${d.y + 4}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.9)" pointer-events="none">${String(d.partner).split(" ")[0]}</text>
      `).join("")}
    </svg>
    <div style="font-size:11px;color:var(--text-tertiary);padding-top:6px;">Circle size = outstanding balance. Hover dots for details. Median lines divide quadrants.</div>
  `;
  // Tooltip hover
  target.querySelectorAll(".partner-dot").forEach((dot) => {
    dot.addEventListener("mouseenter", (e) => {
      if (!tooltip) return;
      const p = e.target.closest("svg").getBoundingClientRect();
      const rect = e.target.getBoundingClientRect();
      tooltip.innerHTML = `<strong>${dot.dataset.partner}</strong>${whole(dot.dataset.loans)} loans · CO rate ${decimalRate(Number(dot.dataset.rate))} · Quadrant: <em>${dot.dataset.quadrant}</em>`;
      tooltip.style.display = "block";
      tooltip.style.left = `${rect.left - p.left + 20}px`;
      tooltip.style.top = `${rect.top - p.top - 10}px`;
    });
    dot.addEventListener("mouseleave", () => { if (tooltip) tooltip.style.display = "none"; });
  });
}

// ── Compliance Expiration Flags ───────────────────────────────────────────────
function renderComplianceExpiration(data) {
  const target = document.querySelector("#compliance-expiration");
  if (!target) return;
  const flags = data.compliance?.expiration_flags || [];
  const compliance = data.compliance || {};
  if (!flags.length) {
    // Build from existing compliance data
    const items = [];
    if (compliance.total_files) {
      items.push({ label: "Total Compliance Files", status: "ok", detail: `${whole(compliance.total_files)} files indexed across all partners` });
    }
    if (compliance.score_avg !== undefined) {
      const scoreStatus = compliance.score_avg > 70 ? "ok" : compliance.score_avg > 50 ? "warning" : "error";
      items.push({ label: "Average Compliance Score", status: scoreStatus, detail: `${compliance.score_avg?.toFixed(1) || "–"}/100 average across all scored partners` });
    }
    if (!items.length) { target.innerHTML = `<div class="empty-state">No compliance expiration data available. Run refresh to generate expiration analysis.</div>`; return; }
    target.innerHTML = items.map((item) => `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${item.status}">${item.status}</span>${item.label}</div>
        <div class="quality-meta">${item.detail}</div>
      </div>
    `).join("");
    return;
  }
  target.innerHTML = flags.map((f) => {
    const status = f.is_stale ? "error" : f.approaching_stale ? "warning" : "ok";
    return `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${status}">${status}</span>${f.doc_type || f.type || "Document"}</div>
        <div class="quality-meta">${f.years_old ? `${f.years_old.toFixed(1)} years old` : ""} ${f.partner ? `· ${f.partner}` : ""} ${f.is_stale ? "· STALE" : f.approaching_stale ? "· Approaching stale" : ""}</div>
      </div>
    `;
  }).join("");
}

// ── Workbook Freshness ────────────────────────────────────────────────────────
function renderWorkbookFreshness(data) {
  const target = document.querySelector("#workbook-freshness");
  if (!target) return;
  const sources = data.data_quality?.source_inventory || [];
  const workbookSources = sources.filter((s) => s.source?.endsWith(".xlsx"));
  if (!workbookSources.length) {
    // Fall back to source_health
    const health = (data.refresh_status?.source_health || []).filter((s) => s.source?.includes("Live Data"));
    if (health.length) {
      target.innerHTML = health.map((h) => `
        <div class="quality-item">
          <div class="quality-title"><span class="tag ${h.status}">${h.status}</span>${h.source}</div>
          <div class="quality-meta">${h.detail || ""}</div>
        </div>
      `).join("");
      return;
    }
    // Show partner list as a summary
    const partners = data.impact?.originations_by_partner || [];
    if (partners.length) {
      target.innerHTML = `
        <div class="quality-item">
          <div class="quality-title"><span class="tag ok">ok</span>Partner Workbooks Loaded</div>
          <div class="quality-meta">${partners.length} partner workbooks parsed. Individual file timestamps require filesystem access during refresh.</div>
        </div>
      `;
      return;
    }
    target.innerHTML = `<div class="empty-state">No workbook freshness data available.</div>`;
    return;
  }
  const now = new Date();
  target.innerHTML = workbookSources.map((s) => {
    const modDate = s.last_modified ? new Date(s.last_modified) : null;
    const daysSince = modDate ? Math.round((now - modDate) / (1000 * 60 * 60 * 24)) : null;
    const status = daysSince === null ? "neutral" : daysSince > 30 ? "error" : daysSince > 14 ? "warning" : "ok";
    return `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${status}">${status}</span>${s.partner || s.name || "Workbook"}</div>
        <div class="quality-meta">${daysSince !== null ? `Last modified ${daysSince} days ago` : "Modification date unknown"} ${s.originations ? `· ${whole(s.originations)} originations` : ""}</div>
      </div>
    `;
  }).join("");
}

function renderImpactCertification(data) {
  const target = document.querySelector("#impact-certification");
  const panel = document.querySelector("#impact-certification-panel");
  if (!target || !panel) return;
  const audit = data.impact?.quality_audit || {};
  const certification = data.reporting_readiness?.page_certification?.impact || {};
  const summary = audit.summary || {};
  const status = certification.status || "not_ready";
  panel.classList.toggle("certified", status === "ready");
  panel.classList.toggle("blocked", status === "not_ready");
  const tone = status === "ready" ? "ok" : status === "not_ready" ? "error" : "warning";
  const manifest = audit.manifest || [];
  const checks = audit.tests || [];
  target.innerHTML = `
    <div class="quality-item">
      <div class="quality-title"><span class="tag ${tone}">${status}</span>Impact reporting status</div>
      <div class="quality-meta">${certification.summary || "Run refresh to calculate Impact certification."}<br>${whole(summary.error_count)} blocking error(s), ${whole(summary.warning_count)} warning(s), ${manifest.length} hashed source workbook(s). Methodology ${audit.methodology_version || "not recorded"}.</div>
    </div>
    ${checks.map((check) => `<div class="quality-item"><div class="quality-title"><span class="tag ${check.status || "warning"}">${check.status || "warning"}</span>${check.name}</div><div class="quality-meta">${check.detail || ""}</div></div>`).join("")}
  `;
  const exportButton = document.querySelector("#demographics-download-btn");
  if (exportButton) {
    exportButton.textContent = status === "ready" ? "Download Excel" : "Download Draft Excel";
    exportButton.title = status === "ready" ? "Automated controls passed; reviewer approval is still required." : "Export includes audit exceptions and is not certified for external use.";
  }
}

function renderPartnerDemographicsTable(data) {
  renderImpactCertification(data);
  const el = document.querySelector("#partner-demographics-table");
  if (!el) return;
  const rows = data.impact?.partner_demographics || [];
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">No partner demographics data yet. Run refresh to populate.</div>`;
    return;
  }

  function pct(v) { return v == null ? "—" : `${(v * 100).toFixed(1)}%`; }
  function bar(v, warn) {
    if (v == null) return "—";
    const pv = Math.min(v * 100, 100);
    const color = warn && v > warn ? "var(--red-400,#ef5350)" : "var(--gold-400)";
    return `<div style="display:flex;align-items:center;gap:0.4rem;">
      <div style="flex:1;background:var(--navy-700);border-radius:2px;height:6px;min-width:40px;">
        <div style="width:${pv.toFixed(1)}%;background:${color};height:6px;border-radius:2px;"></div>
      </div>
      <span style="font-size:0.75rem;min-width:3.2rem;text-align:right;">${pct(v)}</span>
    </div>`;
  }
  function lmiBar(r) {
    if (r.lmi_missing || r.lmi == null) {
      return `<span class="tag warning" title="LMI values are blank in the source workbook">Missing</span>`;
    }
    return bar(r.lmi);
  }

  // Totals row
  const t = {
    originations: rows.reduce((s, r) => s + (r.originations || 0), 0),
    disbursed: rows.reduce((s, r) => s + (r.disbursed || 0), 0),
    outstanding: rows.reduce((s, r) => s + (r.outstanding || 0), 0),
    jobs: rows.reduce((s, r) => s + (r.jobs || 0), 0),
    ta_hours: rows.reduce((s, r) => s + (r.ta_hours || 0), 0),
    delinquent_30_plus: rows.reduce((s, r) => s + (r.delinquent_30_plus || 0), 0),
    chargeoff_amount: rows.reduce((s, r) => s + (r.chargeoff_amount || 0), 0),
    trailing_12m_chargeoff_amount: rows.reduce((s, r) => s + (r.trailing_12m_chargeoff_amount || 0), 0),
  };
  const tOrig = t.originations || 1;
  const tOut  = t.outstanding || 1;
  t.delinquency_rate = t.delinquent_30_plus / tOut;
  t.chargeoff_rate   = t.chargeoff_amount / (t.disbursed || 1);
  t.trailing_12m_chargeoff_rate = t.trailing_12m_chargeoff_amount / tOut;
  ["aa","hispanic","white","asian","other","women"].forEach(k => {
    const demoRows = k === "lmi" ? rows.filter((r) => !r.lmi_missing && r.lmi != null) : rows;
    const demoOrig = demoRows.reduce((s, r) => s + (r.originations || 0), 0) || 1;
    t[k] = demoRows.reduce((s, r) => s + (r[k] || 0) * (r.originations || 0), 0) / demoOrig;
  });
  t.minority = rows.reduce((s, r) => s + (r.minority_positive || 0), 0) / tOrig;
  const lmiEligible = rows.filter((r) => !r.lmi_missing).reduce((s, r) => s + (r.originations || 0), 0) || 1;
  t.lmi = rows.reduce((s, r) => s + (r.lmi_positive || 0), 0) / lmiEligible;

  function dataRow(r, isTotal) {
    const cls = isTotal ? "style='font-weight:700;background:var(--navy-700);'" : "";
    return `<tr ${cls}>
      <td style="text-align:left;padding:0.4rem 0.6rem;white-space:nowrap;">${r.partner}</td>
      <td>${whole(r.originations)}</td>
      <td>${money(r.disbursed)}</td>
      <td>${money(r.outstanding)}</td>
      <td>${bar(r.minority)}</td>
      <td>${bar(r.aa)}</td>
      <td>${bar(r.hispanic)}</td>
      <td>${bar(r.white)}</td>
      <td>${bar(r.asian)}</td>
      <td>${bar(r.other)}</td>
      <td>${lmiBar(r)}</td>
      <td>${bar(r.women)}</td>
      <td>${whole(r.jobs)}</td>
      <td>${whole(r.ta_hours)}</td>
      <td>${money(r.delinquent_30_plus)}</td>
      <td>${bar(r.delinquency_rate, 0.08)}</td>
      <td>${money(r.chargeoff_amount)}</td>
      <td>${bar(r.chargeoff_rate, 0.08)}</td>
    </tr>`;
  }

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
      <thead>
        <tr style="background:var(--navy-900);color:var(--gold-400);font-weight:700;">
          <th style="text-align:left;padding:0.5rem 0.6rem;white-space:nowrap;">CDFI</th>
          <th># Loans</th><th>$ Disbursed</th><th>Outstanding</th>
          <th>Minority</th><th>AA</th><th>Hispanic</th><th>White</th><th>Asian</th><th>Other</th>
          <th>LMI</th><th>Women</th><th>Jobs</th><th>TA Hrs</th>
          <th>30+ DPD</th><th>% Delinq.</th><th>Charge-Offs</th><th>% CO</th><th>% 12M CO</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? "var(--navy-800)" : "transparent"};">
          <td style="text-align:left;padding:0.4rem 0.6rem;white-space:nowrap;color:var(--text-primary);font-weight:600;">${r.partner}</td>
          <td style="text-align:center;">${whole(r.originations)}</td>
          <td style="text-align:center;">${money(r.disbursed)}</td>
          <td style="text-align:center;">${money(r.outstanding)}</td>
          <td>${bar(r.minority)}</td>
          <td>${bar(r.aa)}</td>
          <td>${bar(r.hispanic)}</td>
          <td>${bar(r.white)}</td>
          <td>${bar(r.asian)}</td>
          <td>${bar(r.other)}</td>
          <td>${lmiBar(r)}</td>
          <td>${bar(r.women)}</td>
          <td style="text-align:center;">${whole(r.jobs)}</td>
          <td style="text-align:center;">${whole(r.ta_hours)}</td>
          <td style="text-align:center;">${money(r.delinquent_30_plus)}</td>
          <td>${bar(r.delinquency_rate, 0.08)}</td>
          <td style="text-align:center;">${money(r.chargeoff_amount)}</td>
          <td>${bar(r.chargeoff_rate, 0.08)}</td>
          <td>${bar(r.trailing_12m_chargeoff_rate, 0.08)}</td>
        </tr>`).join("")}
        <tr style="background:var(--navy-700);font-weight:700;border-top:2px solid var(--gold-500);">
          <td style="text-align:left;padding:0.4rem 0.6rem;color:var(--gold-400);">Total</td>
          <td style="text-align:center;">${whole(t.originations)}</td>
          <td style="text-align:center;">${money(t.disbursed)}</td>
          <td style="text-align:center;">${money(t.outstanding)}</td>
          <td>${bar(t.minority)}</td>
          <td>${bar(t.aa)}</td>
          <td>${bar(t.hispanic)}</td>
          <td>${bar(t.white)}</td>
          <td>${bar(t.asian)}</td>
          <td>${bar(t.other)}</td>
          <td>${bar(t.lmi)}</td>
          <td>${bar(t.women)}</td>
          <td style="text-align:center;">${whole(t.jobs)}</td>
          <td style="text-align:center;">${whole(t.ta_hours)}</td>
          <td style="text-align:center;">${money(t.delinquent_30_plus)}</td>
          <td>${bar(t.delinquency_rate, 0.08)}</td>
          <td style="text-align:center;">${money(t.chargeoff_amount)}</td>
          <td>${bar(t.chargeoff_rate, 0.08)}</td>
          <td>${bar(t.trailing_12m_chargeoff_rate, 0.08)}</td>
        </tr>
      </tbody>
    </table>`;
}

function renderParCards(data) {
  const derived = data.impact?.derived_kpis || {};
  const totalOut = data.impact?.totals?.outstanding || 0;
  const par30 = derived.par_30 || 0;
  const par60 = derived.par_60 || 0;
  const par90 = derived.par_90 || 0;
  const p90out = derived.par_90_outstanding || 0;
  const del30out = derived.delinquent_outstanding_30_plus || 0;
  const str60out = derived.stress_outstanding_60_plus || 0;

  function parCard(elId, label, rate, outstanding, note) {
    const el = document.querySelector(`#${elId}`);
    if (!el) return;
    const status = rate > 0.15 ? "error" : rate > 0.08 ? "warning" : "ok";
    const threshold = label === "PAR30" ? "8%" : label === "PAR60" ? "5%" : "3%";
    el.innerHTML = `
      <div class="quality-item">
        <div class="quality-title"><span class="tag ${status}">${(rate * 100).toFixed(2)}%</span>${label} Ratio</div>
        <div class="quality-meta">${money(outstanding)} outstanding — Threshold: ${threshold} (CDFI sector benchmark)</div>
      </div>
      <div class="quality-item">
        <div class="quality-title">Outstanding Portfolio</div>
        <div class="quality-meta">${money(totalOut)} total · ${money(outstanding)} ${label === "PAR30" ? "30+" : label === "PAR60" ? "60+" : "90+"} DPD</div>
      </div>
      <div class="quality-item">
        <div class="quality-title">${note}</div>
      </div>
    `;
  }
  parCard("par-30-card", "PAR30", par30, del30out, par30 <= 0.08 ? "Within benchmark" : par30 <= 0.15 ? "Monitor — above 8% CDFI norm" : "Elevated — requires attention");
  parCard("par-60-card", "PAR60", par60, str60out, par60 <= 0.05 ? "Within benchmark" : par60 <= 0.10 ? "Monitor — above 5% CDFI norm" : "Elevated — requires attention");
  parCard("par-90-card", "PAR90", par90, p90out, par90 <= 0.03 ? "Within benchmark" : par90 <= 0.07 ? "Monitor — above 3% CDFI norm" : "Elevated — severe delinquency");
}

function renderVintageCurve(data) {
  const el = document.querySelector("#vintage-curve-chart");
  if (!el) return;
  const vintageData = (data.impact?.vintage_curve || []).filter(r => r.cohort_age_months > 0);
  if (!vintageData.length) {
    el.innerHTML = `<div class="empty-state">No vintage curve data available. Ensure cohort_performance is populated.</div>`;
    return;
  }
  const maxRate = Math.max(...vintageData.map(r => r.chargeoff_rate || 0), 0.01);
  const maxAge = Math.max(...vintageData.map(r => r.cohort_age_months), 1);
  const W = 720, H = 220, PAD = { top: 20, right: 20, bottom: 50, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const xScale = age => PAD.left + (age / maxAge) * plotW;
  const yScale = r => PAD.top + plotH - (r / maxRate) * plotH;
  const pts = vintageData.map(r => `${xScale(r.cohort_age_months).toFixed(1)},${yScale(r.chargeoff_rate || 0).toFixed(1)}`).join(" ");
  const hasPartial = vintageData.some(r => r.cohort_age_months < 6);
  const dots = vintageData.map(r => {
    const x = xScale(r.cohort_age_months).toFixed(1);
    const y = yScale(r.chargeoff_rate || 0).toFixed(1);
    const partial = r.cohort_age_months < 6;
    const fill = partial ? "var(--navy-700)" : "var(--gold-400)";
    const stroke = partial ? "var(--gold-500)" : "var(--navy-900)";
    const dash = partial ? ' stroke-dasharray="3,2"' : "";
    const tipSuffix = partial ? " · ⚠ Partial — CDFIs still filing" : "";
    return `<circle cx="${x}" cy="${y}" r="${partial ? 4 : 5}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${dash}><title>${r.quarter} · Age ${r.cohort_age_months}mo · CO Rate ${(r.chargeoff_rate * 100).toFixed(2)}%${tipSuffix}</title></circle>`;
  }).join("");
  // X-axis labels every ~12 months
  const xLabels = vintageData.filter((_, i) => i % 2 === 0 || i === vintageData.length - 1).map(r => {
    const x = xScale(r.cohort_age_months).toFixed(1);
    return `<text x="${x}" y="${PAD.top + plotH + 16}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${r.cohort_age_months}mo</text>
    <text x="${x}" y="${PAD.top + plotH + 28}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${r.quarter}</text>`;
  }).join("");
  // Y-axis
  const ySteps = [0, 0.25, 0.5, 0.75, 1.0].map(f => {
    const r = maxRate * f;
    const y = yScale(r).toFixed(1);
    return `<line x1="${PAD.left - 4}" y1="${y}" x2="${PAD.left + plotW}" y2="${y}" stroke="var(--navy-700)" stroke-width="0.5"/>
    <text x="${PAD.left - 8}" y="${parseFloat(y) + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">${(r * 100).toFixed(1)}%</text>`;
  }).join("");
  const partialNote = hasPartial
    ? `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;font-size:0.78rem;color:var(--text-muted);border-top:1px solid var(--navy-700);">
        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="var(--navy-700)" stroke="var(--gold-500)" stroke-width="1.5" stroke-dasharray="3,2"/></svg>
        <span>Dashed rings = partial reporting — recent cohorts where not all CDFIs have filed Q1 2026 data. Charge-off rates for these points will rise as reporting completes.</span>
      </div>`
    : "";
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible;">
    ${ySteps}
    <polyline points="${pts}" fill="none" stroke="var(--gold-400)" stroke-width="2.5" stroke-linejoin="round"/>
    ${dots}
    ${xLabels}
    <text x="${PAD.left + plotW / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="var(--text-muted)">Cohort Age (months since origination quarter start)</text>
    <text x="${PAD.left - 44}" y="${PAD.top + plotH / 2}" text-anchor="middle" font-size="11" fill="var(--text-muted)" transform="rotate(-90,${PAD.left - 44},${PAD.top + plotH / 2})">Charge-off Rate</text>
  </svg>${partialNote}`;
}

function renderTaRoiScatter(data) {
  const el = document.querySelector("#ta-roi-scatter");
  if (!el) return;
  const allRows = data.impact?.ta_roi_scatter || [];
  const rows = allRows.filter(r => r.originations > 0);
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">No partner efficiency data available for TA ROI analysis.</div>`;
    return;
  }
  const hasTa = rows.some(r => r.ta_hours_per_business > 0);
  if (!hasTa) {
    el.innerHTML = `<div class="quality-item"><div class="quality-title">TA Hours Not Yet Reported</div><div class="quality-meta">All partners currently show 0 TA hours. Once workbooks include TA hours, this chart will show the correlation between TA intensity and charge-off rate.</div></div>`;
    return;
  }

  const W = 760, H = 300, PAD = { top: 30, right: 140, bottom: 52, left: 70 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Axis bounds — round up to clean tick values
  const rawMaxX = Math.max(...rows.map(r => r.ta_hours_per_business));
  const rawMaxY = Math.max(...rows.map(r => r.chargeoff_rate || 0));
  const xMax = Math.ceil(rawMaxX / 5) * 5;      // round to nearest 5
  const yMax = Math.ceil(rawMaxY * 100 / 5) * 5 / 100; // round CO% to nearest 5pp

  const xScale = v => PAD.left + (v / xMax) * plotW;
  const yScale = v => PAD.top + plotH - (v / yMax) * plotH;

  // Averages (weighted by originations for more meaningful center lines)
  const totalOrig = rows.reduce((s, r) => s + r.originations, 0);
  const avgX = rows.reduce((s, r) => s + r.ta_hours_per_business * r.originations, 0) / totalOrig;
  const avgY = rows.reduce((s, r) => s + (r.chargeoff_rate || 0) * r.originations, 0) / totalOrig;

  // Linear regression trend line
  const n = rows.length;
  const sumX = rows.reduce((s, r) => s + r.ta_hours_per_business, 0);
  const sumY = rows.reduce((s, r) => s + (r.chargeoff_rate || 0), 0);
  const sumXY = rows.reduce((s, r) => s + r.ta_hours_per_business * (r.chargeoff_rate || 0), 0);
  const sumXX = rows.reduce((s, r) => s + r.ta_hours_per_business ** 2, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const trendY0 = Math.max(0, intercept);
  const trendY1 = Math.max(0, intercept + slope * xMax);

  // Jitter: separate overlapping points on same x value
  const jittered = rows.map((r, i) => {
    const sameX = rows.filter(o => Math.abs(o.ta_hours_per_business - r.ta_hours_per_business) < 0.1);
    const idx = sameX.indexOf(r);
    const jitter = sameX.length > 1 ? (idx - (sameX.length - 1) / 2) * 18 : 0;
    return { ...r, jx: xScale(r.ta_hours_per_business) + jitter };
  });

  // Color by CO rate tier
  const coColor = co => co > 0.12 ? "#ef5350" : co > 0.06 ? "#ffa726" : "#66bb6a";

  // Abbreviated partner names
  const shortName = name => {
    const map = {
      "Cardinal Community Capital": "Cardinal",
      "Harbor Point Fund": "Harbor Point",
      "Ridgeline Development Finance": "Ridgeline",
      "Northgate Community Lenders": "Northgate",
      "Blue Mesa Capital": "Blue Mesa",
      "Trailhead Business Capital": "Trailhead",
      "Silverbrook Fund": "Silverbrook",
      "Copperfield Community Finance": "Copperfield",
      "Lakewind Economic Development": "Lakewind",
    };
    return map[name] || name.split(" ")[0];
  };

  // Grid lines and x-axis ticks
  const xTicks = Array.from({ length: Math.floor(xMax / 5) + 1 }, (_, i) => i * 5);
  const xGrid = xTicks.map(v => {
    const x = xScale(v).toFixed(1);
    return `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${PAD.top + plotH}" stroke="var(--navy-700)" stroke-width="0.5"/>
    <text x="${x}" y="${PAD.top + plotH + 14}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${v}</text>`;
  }).join("");

  const yTicks = Array.from({ length: 5 }, (_, i) => yMax * i / 4);
  const yGrid = yTicks.map(v => {
    const y = yScale(v).toFixed(1);
    return `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + plotW}" y2="${y}" stroke="var(--navy-700)" stroke-width="0.5"/>
    <text x="${PAD.left - 8}" y="${parseFloat(y) + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">${(v * 100).toFixed(0)}%</text>`;
  }).join("");

  // Quadrant shading labels (subtle)
  const qMidX = (xScale(0) + xScale(avgX)) / 2;
  const qHiX  = (xScale(avgX) + xScale(xMax)) / 2;
  const qLoY  = (yScale(avgY) + yScale(0)) / 2;
  const qHiY  = (yScale(yMax) + yScale(avgY)) / 2;

  const circles = jittered.map(r => {
    const x = r.jx.toFixed(1);
    const y = yScale(r.chargeoff_rate || 0).toFixed(1);
    const size = Math.max(7, Math.min(22, Math.sqrt(r.originations) * 1.8));
    const fill = coColor(r.chargeoff_rate || 0);
    const label = shortName(r.partner);
    const labelY = (parseFloat(y) - size - 4).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${size}" fill="${fill}" fill-opacity="0.8" stroke="var(--navy-900)" stroke-width="1.5" style="cursor:default;">
      <title>${r.partner}&#10;TA: ${r.ta_hours_per_business.toFixed(1)} hrs/biz · ${whole(r.ta_businesses)} businesses · ${whole(r.ta_hours)} total hrs&#10;CO Rate: ${((r.chargeoff_rate || 0) * 100).toFixed(2)}%&#10;Originations: ${r.originations}</title>
    </circle>
    <text x="${x}" y="${labelY}" text-anchor="middle" font-size="9" fill="var(--text-primary)" pointer-events="none">${label}</text>`;
  }).join("");

  // Legend
  const legend = [
    { color: "#66bb6a", label: "CO < 6%" },
    { color: "#ffa726", label: "CO 6–12%" },
    { color: "#ef5350", label: "CO > 12%" },
  ].map((item, i) => `
    <circle cx="${W - PAD.right + 16}" cy="${PAD.top + 16 + i * 20}" r="7" fill="${item.color}" fill-opacity="0.8" stroke="var(--navy-900)" stroke-width="1"/>
    <text x="${W - PAD.right + 28}" y="${PAD.top + 20 + i * 20}" font-size="10" fill="var(--text-muted)">${item.label}</text>
  `).join("");

  const trendLine = slope !== 0
    ? `<line x1="${xScale(0).toFixed(1)}" y1="${Math.min(PAD.top + plotH, Math.max(PAD.top, yScale(trendY0))).toFixed(1)}"
            x2="${xScale(xMax).toFixed(1)}" y2="${Math.min(PAD.top + plotH, Math.max(PAD.top, yScale(trendY1))).toFixed(1)}"
            stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="6,4"/>`
    : "";

  el.innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible;">
    ${xGrid}${yGrid}
    <line x1="${xScale(avgX).toFixed(1)}" y1="${PAD.top}" x2="${xScale(avgX).toFixed(1)}" y2="${PAD.top + plotH}"
          stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,3"/>
    <line x1="${PAD.left}" y1="${yScale(avgY).toFixed(1)}" x2="${PAD.left + plotW}" y2="${yScale(avgY).toFixed(1)}"
          stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${xScale(avgX).toFixed(1)}" y="${PAD.top - 6}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.3)">avg TA</text>
    ${trendLine}
    ${circles}
    ${legend}
    <text x="${PAD.left + plotW / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--text-muted)">TA Hours per Business Served</text>
    <text x="${PAD.left - 52}" y="${PAD.top + plotH / 2}" text-anchor="middle" font-size="11" fill="var(--text-muted)"
          transform="rotate(-90,${PAD.left - 52},${PAD.top + plotH / 2})">Charge-off Rate</text>
  </svg>
  <p style="font-size:0.78rem;color:var(--text-muted);padding:0.4rem 1rem 0;">
    Bubble size = origination volume. Color = CO rate tier. Dashed lines = portfolio-weighted averages.
    ${slope < -0.001 ? "Trend line slopes down — higher TA correlates with lower charge-off rate across this portfolio." : slope > 0.001 ? "Trend line slopes up — partners with more TA intensity currently show higher charge-off rates; may reflect higher-risk borrower profiles." : "No strong linear trend detected across partners."}
  </p>`;
}

function renderTargetMarket(data) {
  const el = document.querySelector("#underserved-market-table");
  if (!el) return;
  const rows = (data.impact?.target_market_scoring || []).slice(0, 20);
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">No underserved market data available.</div>`;
    return;
  }
  const maxScore = Math.max(...rows.map(r => r.opportunity_gap_score), 1);
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
    <thead><tr style="color:var(--text-muted);text-align:left;border-bottom:1px solid var(--navy-700);">
      <th style="padding:0.5rem;">State</th>
      <th style="padding:0.5rem;text-align:right;">Small Businesses</th>
      <th style="padding:0.5rem;text-align:right;">Funded Loans</th>
      <th style="padding:0.5rem;text-align:right;">Gap Score</th>
      <th style="padding:0.5rem;">Opportunity</th>
    </tr></thead>
    <tbody>${rows.map((r, i) => {
      const barW = Math.round((r.opportunity_gap_score / maxScore) * 100);
      const tier = r.opportunity_gap_score > 60 ? "high" : r.opportunity_gap_score > 30 ? "medium" : "low";
      const tierColor = tier === "high" ? "var(--gold-400)" : tier === "medium" ? "var(--teal-400, #4db6ac)" : "var(--text-muted)";
      return `<tr style="border-bottom:1px solid var(--navy-800);">
        <td style="padding:0.5rem;font-weight:600;">${r.state}</td>
        <td style="padding:0.5rem;text-align:right;">${(r.small_business_population / 1000).toFixed(0)}K</td>
        <td style="padding:0.5rem;text-align:right;">${r.funded_loans || 0}</td>
        <td style="padding:0.5rem;text-align:right;font-weight:700;color:${tierColor};">${r.opportunity_gap_score.toFixed(1)}</td>
        <td style="padding:0.5rem;">
          <div style="background:var(--navy-800);border-radius:3px;height:8px;width:100%;min-width:80px;">
            <div style="background:${tierColor};border-radius:3px;height:8px;width:${barW}%;"></div>
          </div>
        </td>
      </tr>`;
    }).join("")}</tbody>
  </table>
  <p style="font-size:0.75rem;color:var(--text-muted);padding:0.5rem 0.75rem 0;">Top 20 states by opportunity gap. Score = market size rank minus a penalty for loans already funded there. A directional prompt for where to look, not a demand model — see the KPI guide.</p>`;
}

function renderHistoryComparison(historyData) {
  const fromSel = document.querySelector("#history-date-from");
  const toSel = document.querySelector("#history-date-to");
  const btn = document.querySelector("#history-compare-btn");
  const result = document.querySelector("#history-comparison-result");
  if (!fromSel || !toSel || !btn || !result) return;

  const entries = Array.isArray(historyData) ? historyData : [];
  if (entries.length < 2) {
    result.innerHTML = `<div class="quality-item"><div class="quality-title">Insufficient history</div><div class="quality-meta">Need at least 2 daily snapshots. History accumulates with each daily refresh.</div></div>`;
    return;
  }

  const dates = entries.map(e => e.date);
  fromSel.innerHTML = dates.map(d => `<option value="${d}">${d}</option>`).join("");
  toSel.innerHTML = [...dates].reverse().map(d => `<option value="${d}">${d}</option>`).join("");

  const compareKeys = [
    { key: "originations", label: "Originations", fmt: whole },
    { key: "disbursed", label: "Disbursed", fmt: money },
    { key: "outstanding", label: "Outstanding", fmt: money },
    { key: "chargeoff_amount", label: "Charge-off Amount", fmt: money },
    { key: "chargeoff_rate", label: "Charge-off Rate", fmt: v => rate(v) },
    { key: "trailing_12m_chargeoff_rate", label: "12M Charge-off Rate", fmt: v => rate(v) },
    { key: "par_30", label: "PAR30", fmt: v => rate(v) },
    { key: "par_60", label: "PAR60", fmt: v => rate(v) },
    { key: "par_90", label: "PAR90", fmt: v => rate(v) },
    { key: "delinquency_rate_30_plus", label: "30+ DPD Rate", fmt: v => rate(v) },
    { key: "stress_rate_60_plus", label: "60+ DPD Rate", fmt: v => rate(v) },
    { key: "jobs", label: "Jobs", fmt: whole },
    { key: "crm_pre_screen", label: "CRM Pre-screen", fmt: whole },
  ];

  function doCompare() {
    const fromDate = fromSel.value;
    const toDate = toSel.value;
    const fromEntry = entries.find(e => e.date === fromDate);
    const toEntry = entries.find(e => e.date === toDate);
    if (!fromEntry || !toEntry || fromDate === toDate) {
      result.innerHTML = `<div class="quality-item"><div class="quality-title">Select two different dates</div></div>`;
      return;
    }
    result.innerHTML = compareKeys.map(({ key, label, fmt }) => {
      const a = fromEntry[key];
      const b = toEntry[key];
      if (a == null && b == null) return "";
      const delta = b != null && a != null ? b - a : null;
      const pct = delta != null && a ? (delta / Math.abs(a)) * 100 : null;
      const dir = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
      const color = delta === 0 || delta == null ? "" : (["chargeoff_rate", "par_30", "par_60", "par_90", "delinquency_rate_30_plus", "stress_rate_60_plus"].includes(key))
        ? (delta > 0 ? "color:var(--red-400,#ef5350);" : "color:var(--teal-400,#4db6ac);")
        : (delta > 0 ? "color:var(--teal-400,#4db6ac);" : "color:var(--red-400,#ef5350);");
      return `<div class="quality-item">
        <div class="quality-title">${label}</div>
        <div class="quality-meta" style="display:flex;gap:1rem;flex-wrap:wrap;">
          <span>${fromDate}: <strong>${a != null ? fmt(a) : "—"}</strong></span>
          <span>${toDate}: <strong>${b != null ? fmt(b) : "—"}</strong></span>
          ${delta != null ? `<span style="${color}font-weight:700;">${dir} ${fmt(Math.abs(delta))}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}</span>` : ""}
        </div>
      </div>`;
    }).join("");
  }

  btn.onclick = doCompare;
  // Auto-compare first and last on load
  doCompare();
}

function renderDashboard(data) {
  if (data.metric_catalog?.definitions?.length) {
    state.metricCatalog = data.metric_catalog.definitions;
  }
  const impact = data.impact || {};
  const totals = impact.totals || {};
  const derived = impact.derived_kpis || {};
  const rds = data.rds || {};
  const matcher = data.matcher || {};
  const crmView = buildCrmFilteredView(data);
  const preScreenTotal = (rds.pre_screen_status_by_cdfi || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
  const stateMappedPreScreen = (rds.pre_screen_by_state || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
  const issues = data.data_quality?.issues || [];
  const qualityStatus = data.data_quality?.summary?.status || (issues.length ? "warning" : "ok");

  document.querySelector("#last-refresh").textContent = shortDate(data.generated_at);
  bindCrmDateControls(data);
  document.querySelector("#hero-meta").innerHTML = `
    ${whole(preScreenTotal)} PRE_SCREEN records<br>
    ${whole(totals.originations)} originations<br>
    ${issues.length ? `${whole(issues.length)} data ${qualityStatus === "error" ? "issues" : "warnings"}` : "No active warnings"}
  `;

  renderOverview(data);
  renderVelocityPanel(data);
  renderCapitalRecycling("capital-recycling", impact.capital_recycling);
  renderConcentrationOverview(data);
  renderTrend("originations-trend", impact.originations_by_quarter || []);
  const q4_2025 = quarterRow(impact.originations_by_quarter || [], "2025Q4");
  const latestOriginationsQuarter = latestQuarterRow(impact.originations_by_quarter || []);
  document.querySelector("#originations-trend-note").innerHTML = q4_2025
    ? `Q4 2025 is ${whole(q4_2025.originations)} Live Data originations and ${money(q4_2025.disbursed)} disbursed. ${latestOriginationsQuarter?.quarter === "2026Q1" ? `The final point is ${latestOriginationsQuarter.quarter}: ${whole(latestOriginationsQuarter.originations)} originations and ${money(latestOriginationsQuarter.disbursed)} disbursed.` : ""}`
    : "Quarterly trend uses Live Data origination dates.";
  renderBars("partner-disbursed", impact.originations_by_partner || [], "disbursed", money, 10);

  const riskTotal = Object.values(rds.risk || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const unassigned = crmView.statusRows.filter((row) => row.status === "Unassigned").reduce((sum, row) => sum + Number(row.count || 0), 0);
  const approved = crmView.statusRows.filter((row) => row.status === "Approved").reduce((sum, row) => sum + Number(row.count || 0), 0);
  renderKpis("crm-kpis", [
    { label: "Leads Generated", value: whole(crmView.leadTotal), note: crmView.label },
    { label: "Unassigned", value: whole(unassigned), note: `${percent(unassigned, crmView.leadTotal)} of selected leads` },
    { label: "Approved", value: whole(approved), note: `${percent(approved, crmView.leadTotal)} of selected leads` },
    { label: "CDFIs Touched", value: whole(crmView.cdfiCount), note: "Unique partner queues in window" },
  ]);
  renderCrmPipelineWaterfall(data, crmView.rates, crmView.label);
  renderCrmMatrix(crmView.statusRows);
  renderFunnelRates(crmView.rates, crmView.label);
  renderStageAbandonment(data);
  renderMonthlyTrend("monthly-pre-screen-trend", crmView.monthlyVolume, "count", whole, "Monthly PRE_SCREEN demand");
  renderDictionaryBars("risk-list", rds.risk || {});
  renderDictionaryBars("soft-pull-list", rds.soft_pull || {});
  renderGeography(data);
  renderGeoGapTable(data);
  renderStatePenetration(data);

  renderKpis("impact-kpis", [
    { label: "Jobs", value: whole(totals.jobs), note: "Created or retained" },
    { label: "Average Loan Size", value: money(derived.average_loan_size), note: "Live Data disbursed / originations" },
    { label: "Jobs per $1M", value: whole(derived.jobs_per_million_deployed), note: "Reported jobs per deployed capital" },
    { label: "Charge-off Rate", value: rate(derived.chargeoff_rate_on_disbursed), note: `${money(totals.chargeoff_amount)} charge-offs` },
    { label: "12M Charge-off Rate", value: rate(derived.trailing_12m_chargeoff_rate), note: "Trailing 12-month charge-offs / outstanding" },
    { label: "30+ DPD Exposure", value: rate(derived.delinquency_rate_30_plus), note: `${money(derived.delinquent_outstanding_30_plus)} outstanding` },
    { label: "60+ DPD Stress", value: rate(derived.stress_rate_60_plus), note: `${money(derived.stress_outstanding_60_plus)} outstanding` },
    { label: "TA Hours", value: whole(totals.ta_hours), note: `${whole(totals.ta_businesses)} businesses served` },
    { label: "TA Intensity", value: whole(derived.ta_hours_per_business), note: "Hours per TA business" },
  ]);
  renderBars("aging-band", impact.aging_by_band || [], "outstanding", money, 8);
  renderDictionaryBars("demographics", impact.demographics || {});
  renderPartnerDemographicsTable(data);
  renderCapitalRecycling("impact-capital-recycling", impact.capital_recycling);
  renderLoanSizeBuckets(data);
  renderDpdWatch("dpd-watch-list", data);
  renderCohortTable(data);
  renderRolling12m(data);
  renderChargeoffTrend(data);
  renderRunoffProjection(data);

  renderPartnerHealthTable(data.partner_health?.partners || []);
  renderComplianceTable(data);
  renderPartnerTable(mergePartnerRows(impact));
  renderPartnerEfficiencyTable(data);
  renderDataCompleteness(data);
  renderMarketing(data);

  const bandTotal = Object.values(matcher.decision_band || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const newMatches = Number((matcher.status || {}).new || 0);
  renderKpis("matcher-kpis", [
    { label: "Match Records", value: whole(matcher.total_matches), note: "Reconciliation run output" },
    { label: "New Queue", value: whole(newMatches), note: `${percent(newMatches, matcher.total_matches)} unresolved/new` },
    { label: "Decision Bands", value: whole(bandTotal), note: "Auto, review, possible" },
    { label: "Lenders", value: whole(Object.keys(matcher.lender_code || {}).length), note: "With surfaced matches" },
  ]);
  renderDictionaryBars("match-status", matcher.status || {});
  renderDictionaryBars("match-bands", matcher.decision_band || {});
  loadMatcherDetail();

  renderAnalytics(data);
  renderCrmBridge(data);
  renderHistorySummary(data);
  renderVelocityForecast(data);
  renderRolling12mCompare(data);
  renderSeasonalChart(data);
  renderDemandSupplyLag(data);
  renderCostPerJob(data);
  renderMetricGuide();
  renderQuality(data);

  // Geography
  renderGeoCrmNote(data);
  renderRdsStaleBanner(data);

  // Funnel
  renderFunnelRiskFlags(data);

  // Partners
  renderPartnerDsoTable(data);
  renderPartnerGrowthChart(data);
  renderPartnerMatrix(data);
  renderTaRoiScatter(data);

  // Impact — PAR ratios and vintage curve
  renderParCards(data);
  renderVintageCurve(data);

  // Geography — underserved market
  renderTargetMarket(data);

  // Quality
  renderComplianceExpiration(data);
  renderWorkbookFreshness(data);

  // Historical comparison — the daily series ships inside the payload.
  renderHistoryComparison(data.history?.daily || []);
}

// Every path is relative so the site works from a project subpath as well as
// from a domain root.
async function loadJSON(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return response.json();
}

async function loadStateTopology() {
  try {
    state.mapTopology = await loadJSON("assets/us-states-albers-10m.json");
  } catch (error) {
    state.mapTopology = null;
  }
}

async function loadPaidSearch() {
  try {
    googleAdsSample = await loadJSON("data/paid_search.json");
  } catch (error) {
    googleAdsSample.refresh_status = "unavailable";
  }
}

async function boot() {
  document.body.dataset.currentPage = state.currentPage;
  try {
    const storedOverviewMode = localStorage.getItem(OVERVIEW_MODE_STORAGE_KEY);
    if (storedOverviewMode === "board" || storedOverviewMode === "internal") {
      state.overviewMode = storedOverviewMode;
    }
  } catch (error) {
    state.overviewMode = "internal";
  }

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setPage(button.dataset.page));
  });

  document.querySelector("#demographics-download-btn")
    ?.addEventListener("click", exportDemographicsCsv);

  document.querySelector("#refresh-btn").addEventListener("click", async () => {
    const btn = document.querySelector("#refresh-btn");
    const label = document.querySelector("#last-refresh");
    if (btn.classList.contains("spinning")) return;
    btn.classList.add("spinning");
    const t0 = Date.now();
    const tick = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      label.textContent = `Refreshing\u2026 ${s}s`;
    }, 1000);
    label.textContent = "Refreshing\u2026";
    try {
      // There is no pipeline behind this build, so refresh re-reads the
      // published dataset rather than regenerating it.
      state.data = await loadJSON("data/dashboard.json");
      state.metricCatalog = state.data.metric_catalog?.definitions || [];
      renderDashboard(state.data);
    } catch (e) {
      label.textContent = "Refresh failed";
      console.error("Refresh error:", e);
    } finally {
      clearInterval(tick);
      btn.classList.remove("spinning");
    }
  });

  try {
    const [data] = await Promise.all([
      loadJSON("data/dashboard.json"),
      loadStateTopology(),
      loadPaidSearch(),
    ]);
    state.data = data;
    state.metricCatalog = data.metric_catalog?.definitions || [];
    renderDashboard(state.data);
  } catch (error) {
    document.querySelector("#last-refresh").textContent = "Data unavailable";
    document.querySelector("#hero-meta").textContent = "Run tools/generate_demo_data.py to build the dataset.";
    document.querySelector("#overview-kpis").innerHTML = `<div class="empty-state">The demo dataset could not be loaded. Run <code>python tools/generate_demo_data.py</code>, then reload this page.</div>`;
    console.error("Load error:", error);
  }
}

// ── Fee reconciliation (matcher detail) ─────────────────────────────────────
const matcherState = { rows: [], events: [], loaded: false, wired: false };

// Regressive marketing fee schedule (mirrors marketing_origination.py):
//   <= $250,000   -> 2.5% capped at $2,500
//   <= $500,000   -> flat $3,000
//   >  $500,000   -> flat $5,000
function matcherSuggestedFee(amount) {
  const value = Number(amount || 0);
  if (!value || value <= 0) return null;
  if (value <= 250000) return Math.round(Math.min(value * 0.025, 2500) * 100) / 100;
  if (value <= 500000) return 3000;
  return 5000;
}

function escapeMatcherHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function matcherShortDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

async function loadMatcherDetail() {
  try {
    const payload = await loadJSON("data/fee_reconciliation.json");
    matcherState.rows = payload.records || [];
    matcherState.events = payload.billing_events || [];
    matcherState.loaded = true;
    wireMatcherControls();
    populateMatcherFilters(payload);
    renderMatcherKpisLive();
    renderMatcherTable();
    renderMatcherBillingHistory();
  } catch (error) {
    const table = document.querySelector("#matcher-table");
    if (table) table.innerHTML = `<div class="empty-state">Match history unavailable: ${escapeMatcherHtml(error.message)}</div>`;
  }
}

function populateMatcherFilters(payload) {
  const quarters = payload.quarters || [];
  const cdfis = [...new Set(matcherState.rows.map((row) => row.crm_cdfi_code || row.lender_code).filter(Boolean))].sort();
  const quarterSelect = document.querySelector("#matcher-filter-quarter");
  const invoiceQuarter = document.querySelector("#matcher-invoice-quarter");
  const cdfiSelect = document.querySelector("#matcher-filter-cdfi");
  if (quarterSelect && quarterSelect.options.length <= 1) {
    quarters.forEach((q) => quarterSelect.append(new Option(q, q)));
  }
  if (invoiceQuarter && invoiceQuarter.options.length === 0) {
    invoiceQuarter.append(new Option("All periods", ""));
    quarters.forEach((q) => invoiceQuarter.append(new Option(q, q)));
  }
  if (cdfiSelect && cdfiSelect.options.length <= 1) {
    cdfis.forEach((c) => cdfiSelect.append(new Option(c, c)));
  }
}

function renderMatcherKpisLive() {
  const rows = matcherState.rows;
  const byStatus = {};
  const byBand = {};
  rows.forEach((row) => {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    byBand[row.decision_band] = (byBand[row.decision_band] || 0) + 1;
  });
  const newCount = byStatus.new || 0;
  const confirmedValue = rows
    .filter((row) => row.status === "confirmed" || row.status === "billed")
    .reduce((sum, row) => sum + Number(row.primary_origination_amount || 0), 0);
  renderKpis("matcher-kpis", [
    { label: "Match Records", value: whole(rows.length), note: "Reconciliation run output" },
    { label: "Needs Review", value: whole(newCount), note: `${byBand.auto_accept ? whole(rows.filter((r) => r.status === "new" && r.decision_band === "auto_accept").length) : 0} are auto-accept band` },
    { label: "Confirmed + Billed", value: whole((byStatus.confirmed || 0) + (byStatus.billed || 0)), note: `${money(confirmedValue)} originated` },
    { label: "Rejected", value: whole(byStatus.rejected || 0), note: "Includes auto-rejected date-rule rows" },
  ]);
  renderDictionaryBars("match-status", byStatus);
  renderDictionaryBars("match-bands", byBand);
}

function matcherFilteredRows() {
  const status = document.querySelector("#matcher-filter-status")?.value ?? "new";
  const band = document.querySelector("#matcher-filter-band")?.value ?? "";
  const cdfi = document.querySelector("#matcher-filter-cdfi")?.value ?? "";
  const quarter = document.querySelector("#matcher-filter-quarter")?.value ?? "";
  return matcherState.rows.filter((row) =>
    (!status || row.status === status) &&
    (!band || row.decision_band === band) &&
    (!cdfi || (row.crm_cdfi_code || row.lender_code) === cdfi) &&
    (!quarter || row.origination_quarter === quarter)
  );
}

function renderMatcherTable() {
  const container = document.querySelector("#matcher-table");
  if (!container) return;
  const rows = matcherFilteredRows();
  const meta = document.querySelector("#matcher-table-meta");
  if (meta) meta.textContent = `${rows.length} of ${matcherState.rows.length} match records shown`;
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No match records for the selected filters.</div>`;
    return;
  }
  const bandLabel = { auto_accept: "Auto", review: "Review", possible_match: "Possible" };
  const body = rows.map((row) => {
    const key = escapeMatcherHtml(row.match_key);
    const signals = escapeMatcherHtml(row.supporting_signals || "");
    const altLine = row.matched_live_variant && row.matched_candidate_variant
      ? `matched "${escapeMatcherHtml(row.matched_live_variant)}" ↔ "${escapeMatcherHtml(row.matched_candidate_variant)}"`
      : "";
    const billedInfo = row.status === "billed" && row.billed_amount
      ? `<br><small>${money(Number(row.billed_amount))} · ${escapeMatcherHtml(row.billed_quarter || "")}</small>`
      : "";
    return `
      <tr data-match-key="${key}">
        <td><span class="matcher-pill matcher-pill-${escapeMatcherHtml(row.status)}">${escapeMatcherHtml(row.status)}</span>${billedInfo}</td>
        <td>${escapeMatcherHtml(bandLabel[row.decision_band] || row.decision_band)}<br><small>${Number(row.match_score || 0).toFixed(0)} pts</small></td>
        <td>${escapeMatcherHtml(row.crm_cdfi_code || row.lender_code || "")}<br><small>${escapeMatcherHtml(row.state || "")}</small></td>
        <td title="${signals}">
          <strong>${escapeMatcherHtml(row.live_business_name || "")}</strong><br>
          <small>CRM: ${escapeMatcherHtml(row.crm_business_name || "")}</small><br>
          <small class="matcher-muted">${altLine}</small>
        </td>
        <td>${matcherShortDate(row.lead_start_date)}</td>
        <td>${matcherShortDate(row.primary_origination_date)}<br><small>${escapeMatcherHtml(row.origination_quarter || "")}</small></td>
        <td>${money(Number(row.primary_origination_amount || 0))}</td>
        <td>${escapeMatcherHtml(row.candidate_status || "")}<br><small>App #${escapeMatcherHtml(row.candidate_application_id)}</small></td>
        <td>
          <div class="matcher-actions">
            <button class="matcher-button matcher-confirm" data-status="confirmed" title="Confirm match">✓</button>
            <button class="matcher-button matcher-reject" data-status="rejected" title="Reject match">✗</button>
            <button class="matcher-button matcher-billed" data-status="billed" title="Mark billed">$</button>
          </div>
          <input class="matcher-note" type="text" placeholder="note (optional)" value="${escapeMatcherHtml(row.status_note || "")}" />
        </td>
      </tr>`;
  }).join("");
  container.innerHTML = `
    <table class="matcher-history-table">
      <thead>
        <tr>
          <th>Status</th><th>Band</th><th>CDFI</th><th>Business (live vs CRM)</th>
          <th>Lead Date</th><th>Loan Date</th><th>Amount</th><th>CRM Status</th><th>Review</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
  container.querySelectorAll(".matcher-actions .matcher-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const tr = event.target.closest("tr");
      const matchKey = tr?.dataset.matchKey;
      const note = tr?.querySelector(".matcher-note")?.value ?? "";
      await applyMatcherStatus(matchKey, button.dataset.status, note, button);
    });
  });
}

async function applyMatcherStatus(matchKey, status, note, button) {
  if (!matchKey || !status) return;
  const row = matcherState.rows.find((item) => item.match_key === matchKey);
  const body = { match_key: matchKey, status, note };
  if (status === "billed") {
    const suggested = row?.suggested_fee ?? matcherSuggestedFee(row?.primary_origination_amount);
    const basis = row?.fee_basis ? ` (${row.fee_basis})` : "";
    const amountInput = prompt(
      `Marketing fee to bill for "${row?.live_business_name || matchKey}"${basis}:`,
      suggested != null ? String(suggested) : ""
    );
    if (amountInput === null) return; // canceled
    const amount = Number(String(amountInput).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Billed amount must be a positive number.");
      return;
    }
    const quarterInput = prompt(
      "Billing quarter (e.g. 2026Q2):",
      row?.origination_quarter || ""
    );
    if (quarterInput === null) return;
    body.billed_amount = amount;
    body.billed_quarter = String(quarterInput).trim().toUpperCase();
  }
  const original = button.textContent;
  button.textContent = "…";
  button.disabled = true;
  try {
    // This build has no server to write to, so decisions are applied to the
    // in-memory rows. They behave normally for the rest of the session and are
    // gone on reload; the banner on this page says so.
    if (!row) throw new Error("row not found");
    row.status = status;
    row.status_note = note || "";
    row.status_updated_at = new Date().toISOString();
    if (status === "billed") {
      row.billed_amount = body.billed_amount;
      row.billed_quarter = body.billed_quarter;
      row.invoice_date = new Date().toISOString().slice(0, 10);
    } else {
      row.billed_amount = null;
      row.billed_quarter = null;
      row.invoice_date = null;
    }
    renderMatcherKpisLive();
    renderMatcherTable();
    renderMatcherBillingHistory();
  } catch (error) {
    button.textContent = original;
    button.disabled = false;
    alert(`Could not update match: ${error.message}`);
  }
}

function renderMatcherBillingHistory() {
  const container = document.querySelector("#matcher-billing-history");
  if (!container) return;
  const billed = matcherState.rows
    .filter((row) => row.status === "billed")
    .sort((a, b) => String(b.invoice_date || "").localeCompare(String(a.invoice_date || "")));
  const meta = document.querySelector("#matcher-billing-meta");
  const totalBilled = billed.reduce((sum, row) => sum + Number(row.billed_amount || 0), 0);
  if (meta) meta.textContent = `${billed.length} billed loans · ${money(totalBilled)} total marketing fees`;
  if (!billed.length) {
    container.innerHTML = `<div class="empty-state">Nothing marked billed yet.</div>`;
    return;
  }
  const body = billed.map((row) => `
    <tr>
      <td>${escapeMatcherHtml(row.billed_quarter || "")}</td>
      <td>${escapeMatcherHtml(row.crm_cdfi_code || row.lender_code || "")}</td>
      <td><strong>${escapeMatcherHtml(row.live_business_name || "")}</strong></td>
      <td>${matcherShortDate(row.lead_start_date)}</td>
      <td>${matcherShortDate(row.primary_origination_date)}</td>
      <td>${money(Number(row.primary_origination_amount || 0))}</td>
      <td>${money(Number(row.billed_amount || 0))}</td>
      <td>${matcherShortDate(row.invoice_date)}</td>
      <td>${escapeMatcherHtml(row.status_note || "")}</td>
    </tr>`).join("");
  container.innerHTML = `
    <table class="matcher-history-table">
      <thead>
        <tr>
          <th>Billed Qtr</th><th>CDFI</th><th>Business</th><th>Lead Date</th>
          <th>Loan Date</th><th>Origination</th><th>Fee Billed</th><th>Invoice Date</th><th>Note</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <div id="matcher-invoice-archive"></div>`;
  renderMatcherInvoiceArchive();
}

function renderMatcherInvoiceArchive() {
  const container = document.querySelector("#matcher-invoice-archive");
  if (!container) return;
  // The server-side archive kept a copy of every invoice file it generated, as
  // evidence of what had been sent. There is nowhere to keep one here, so the
  // archive lists what this session has produced instead.
  const files = matcherState.invoices || [];
  if (!files.length) {
    container.innerHTML = "";
    return;
  }
  const items = files.map((file) => `
    <li>${escapeMatcherHtml(file.name)}<small> · ${matcherShortDate(file.created_at)} · ${file.count} loan(s)</small></li>`
  ).join("");
  container.innerHTML = `
    <div class="matcher-archive">
      <h4>Invoices generated this session</h4>
      <ul>${items}</ul>
      <p class="muted">Downloaded to your machine. Nothing is stored server-side in this build.</p>
    </div>`;
}

function wireMatcherControls() {
  if (matcherState.wired) return;
  matcherState.wired = true;
  ["#matcher-filter-status", "#matcher-filter-band", "#matcher-filter-cdfi", "#matcher-filter-quarter"].forEach((selector) => {
    document.querySelector(selector)?.addEventListener("change", renderMatcherTable);
  });
  document.querySelector("#matcher-export-invoices")?.addEventListener("click", async () => {
    const quarter = document.querySelector("#matcher-invoice-quarter")?.value ?? "";
    const statuses = document.querySelector("#matcher-invoice-statuses")?.value ?? "confirmed,billed";
    const note = document.querySelector("#matcher-export-note");
    if (note) note.textContent = "Building invoices…";
    try {
      // The server built an XLSX. Here the same rows are written to CSV in the
      // browser, which needs no dependency and no backend.
      const wanted = statuses.split(",").map((s) => s.trim()).filter(Boolean);
      const selected = matcherState.rows.filter((row) =>
        wanted.includes(row.status) &&
        (!quarter || row.origination_quarter === quarter));

      if (!selected.length) throw new Error("No matching loans for that quarter and status.");

      const columns = ["match_key", "live_business_name", "crm_business_name",
                       "lender_code", "state", "origination_quarter",
                       "primary_origination_date", "primary_origination_amount",
                       "match_score", "decision_band", "status", "fee_basis",
                       "fee_amount", "billed_amount", "billed_quarter", "invoice_date"];
      const csv = [columns.join(",")]
        .concat(selected.map((row) => columns.map((c) => csvCell(row[c])).join(",")))
        .join("\r\n");

      const stamp = new Date().toISOString().slice(0, 10);
      const name = `marketing_invoices_${quarter || "all"}_${stamp}.csv`;
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);

      matcherState.invoices = matcherState.invoices || [];
      matcherState.invoices.unshift({
        name, created_at: new Date().toISOString(), count: selected.length,
      });
      if (note) note.textContent = `Exported ${selected.length} loan(s) as ${name}.`;

      if (wanted.includes("confirmed") && selected.length) {
        const shouldBill = confirm(
          `Invoice exported with ${selected.length} confirmed loan(s).\n\n` +
          `Mark all ${selected.length} as BILLED now? They will drop out of future invoice exports.`
        );
        if (shouldBill) {
          const billedQuarter = quarter || selected[0].quarter_first_seen;
          selected.forEach((row) => {
            row.status = "billed";
            row.billed_amount = row.fee_amount;
            row.billed_quarter = billedQuarter;
            row.invoice_date = stamp;
            row.status_updated_at = new Date().toISOString();
          });
          if (note) note.textContent = `${selected.length} loans marked billed (${billedQuarter}). Not persisted in this build.`;
          renderMatcherKpisLive();
          renderMatcherTable();
          renderMatcherBillingHistory();
        }
      }
      renderMatcherInvoiceArchive();
    } catch (error) {
      if (note) note.textContent = error.message;
    }
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

boot();
