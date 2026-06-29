// DEMO / SAMPLE DATA — Regulatory Compliance (Screen 12, `/regulatory`).
// RiversBet (Nigeria) sample dataset, returned by getRegulatoryData when
// NEXT_PUBLIC_DEMO_MODE=true and rendered by the public /preview/regulatory
// route. Explicitly sample data — richly populated so the page is fully visible
// against the #9 Regulatory Compliance mockup. Shape matches RegulatoryData
// EXACTLY (incl. the ComplianceStatus enum: the mockup's "non_compliant" maps to
// the type's "violation" — red ✗ in the matrix, as specified).
//
// RiversBet is the OWN brand (cobalt-highlighted, top row). Competitors are
// SportyBet, BetKing, 1xBet and NairaBet. Two competitors carry verbatim
// violations (NairaBet bonus terms, 1xBet age verification). The source-document
// list cites the active NG/KE regulator filings behind the compliance call.

import type { RegulatoryData } from "@/lib/data/regulatory";

export const DEMO_REGULATORY: RegulatoryData = {
  scanWeek: "2025-05-12",
  markets: ["nigeria"],
  rows: [
    {
      competitorId: "demo-brand-riversbet",
      name: "RiversBet",
      tier: null,
      market: "nigeria",
      score: 76,
      isOwnBrand: true,
      statuses: {
        age_verification: "compliant",
        licence_display: "compliant",
        responsible_gambling: "partial",
        bonus_terms: "violation",
        data_privacy: "compliant",
        withdrawal_terms: "partial",
      },
    },
    {
      competitorId: "demo-comp-sportybet",
      name: "SportyBet",
      tier: "direct",
      market: "nigeria",
      score: 92,
      isOwnBrand: false,
      statuses: {
        age_verification: "compliant",
        licence_display: "compliant",
        responsible_gambling: "compliant",
        bonus_terms: "compliant",
        data_privacy: "compliant",
        withdrawal_terms: "partial",
      },
    },
    {
      competitorId: "demo-comp-betking",
      name: "BetKing",
      tier: "direct",
      market: "nigeria",
      score: 78,
      isOwnBrand: false,
      statuses: {
        age_verification: "compliant",
        licence_display: "compliant",
        responsible_gambling: "partial",
        bonus_terms: "partial",
        data_privacy: "compliant",
        withdrawal_terms: "partial",
      },
    },
    {
      competitorId: "demo-comp-1xbet",
      name: "1xBet",
      tier: "direct",
      market: "nigeria",
      score: 65,
      isOwnBrand: false,
      statuses: {
        age_verification: "violation",
        licence_display: "partial",
        responsible_gambling: "partial",
        bonus_terms: "partial",
        data_privacy: "compliant",
        withdrawal_terms: "partial",
      },
    },
    {
      competitorId: "demo-comp-nairabet",
      name: "NairaBet",
      tier: "secondary",
      market: "nigeria",
      score: 48,
      isOwnBrand: false,
      statuses: {
        age_verification: "partial",
        licence_display: "compliant",
        responsible_gambling: "missing",
        bonus_terms: "violation",
        data_privacy: "partial",
        withdrawal_terms: "missing",
      },
    },
  ],
  violations: [
    {
      competitorId: "demo-comp-nairabet",
      competitorName: "NairaBet",
      violations: [
        {
          dimension: "bonus_terms",
          severity: "high",
          description:
            "Bonus terms reserve a unilateral right to modify or cancel any bonus without prior notice and without a clearly displayed cap disclosure.",
          sourceUrl: "https://nairabet.com/terms.pdf",
          quote:
            "Max bonus amount is ₦100,000. Company reserves the right to modify or cancel any bonus without prior notice.",
        },
      ],
    },
    {
      competitorId: "demo-comp-1xbet",
      competitorName: "1xBet",
      violations: [
        {
          dimension: "age_verification",
          severity: "medium",
          description:
            "No age-verification gate at registration; the privacy notice concedes that under-18 users may access the platform.",
          sourceUrl: "https://1xbet.com/privacy.pdf",
          quote:
            "No age verification on registration; users under 18 may access the platform.",
        },
      ],
    },
  ],
  documents: [
    {
      id: "demo-doc-nlrc-marketing",
      documentName: "NLRC Update – Marketing Guidelines",
      documentType: "guideline",
      regulatoryBody: "National Lottery Regulatory Commission",
      country: "Nigeria",
      sourceUrl: "https://lotteryregulation.gov.ng/marketing-guidelines",
      version: "2025.1",
      effectiveDate: "2025-05-17",
      lastVerifiedAt: "2025-05-17",
    },
    {
      id: "demo-doc-bclb-policy",
      documentName: "BCLB Policy Change",
      documentType: "policy",
      regulatoryBody: "Betting Control and Licensing Board",
      country: "Kenya",
      sourceUrl: "https://bclb.go.ke/policy-change-2025",
      version: "2025.2",
      effectiveDate: "2025-05-09",
      lastVerifiedAt: "2025-05-09",
    },
    {
      id: "demo-doc-kenya-betting-act",
      documentName: "Kenya Betting Control Act Amendment",
      documentType: "amendment",
      regulatoryBody: "Betting Control and Licensing Board",
      country: "Kenya",
      sourceUrl: "https://bclb.go.ke/betting-control-act-amendment-2025",
      version: "2025",
      effectiveDate: "2025-05-12",
      lastVerifiedAt: "2025-05-12",
    },
  ],
  totals: {
    competitorsScored: 4,
    avgCompetitorScore: 71,
    openViolations: 2,
  },
};
