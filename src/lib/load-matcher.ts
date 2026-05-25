import { and, eq, ilike, or } from "drizzle-orm";
import { loads } from "@/db/schema";
import type { DB } from "@/db";

export type Load = typeof loads.$inferSelect;

export type LoadMatchResult = {
  load: Load | null;
  confidence: number;
  matchedBy: string[];
  alternates: Load[];
  requiresReview: boolean;
};

type CandidateScore = {
  load: Load;
  score: number;
  signals: string[];
};

const normalize = (value?: string | null) => (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const alnum = (value?: string | null) => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const maybeAdd = (arr: string[], value?: string | null) => {
  if (value && value.trim()) arr.push(value.trim());
};

function parseLane(lane?: string | null): { origin: string; destination: string } | null {
  if (!lane) return null;
  const parts = lane.split(/\s*(?:->|→|-|to)\s*/i).map((p) => normalize(p));
  if (parts.length < 2) return null;
  const origin = parts[0];
  const destination = parts[1];
  if (!origin || !destination) return null;
  return { origin, destination };
}

function laneSignalScore(candidate: Load, extractedLane?: string | null): number {
  const lane = parseLane(extractedLane);
  if (!lane) return 0;
  const origin = normalize([candidate.originCity, candidate.originState].filter(Boolean).join(" "));
  const destination = normalize([candidate.destinationCity, candidate.destinationState].filter(Boolean).join(" "));
  if (!origin || !destination) return 0;

  const originHit = origin.includes(lane.origin) || lane.origin.includes(origin);
  const destinationHit = destination.includes(lane.destination) || lane.destination.includes(destination);
  if (originHit && destinationHit) return 0.18;
  return 0;
}

type ClassificationInput = {
  extractedLoadNumber?: string | null;
  extractedPoNumber?: string | null;
  extractedCustomer?: string | null;
  extractedCarrier?: string | null;
  extractedLane?: string | null;
};

function computeScore(candidate: Load, classification: ClassificationInput): CandidateScore {
  let score = 0;
  const signals: string[] = [];

  if (classification.extractedLoadNumber) {
    const a = alnum(classification.extractedLoadNumber);
    const b = alnum(candidate.loadNumber);
    if (a && b && a === b) {
      score += 0.7;
      signals.push("load_number");
    }
  }

  if (classification.extractedPoNumber && candidate.poNumber) {
    const a = alnum(classification.extractedPoNumber);
    const b = alnum(candidate.poNumber);
    if (a && b && a === b) {
      score += 0.6;
      signals.push("po_number");
    }
  }

  if (classification.extractedCustomer && candidate.customerName) {
    const extractedCustomer = normalize(classification.extractedCustomer);
    const loadCustomer = normalize(candidate.customerName);
    if (extractedCustomer && loadCustomer && (loadCustomer.includes(extractedCustomer) || extractedCustomer.includes(loadCustomer))) {
      score += 0.25;
      signals.push("customer_name");
    }
  }

  const laneScore = laneSignalScore(candidate, classification.extractedLane);
  if (laneScore > 0) {
    score += laneScore;
    signals.push("lane");
  }

  if (classification.extractedCarrier && candidate.carrierName) {
    const extractedCarrier = normalize(classification.extractedCarrier);
    const loadCarrier = normalize(candidate.carrierName);
    if (extractedCarrier && loadCarrier && (loadCarrier.includes(extractedCarrier) || extractedCarrier.includes(loadCarrier))) {
      score += 0.1;
      signals.push("carrier_name");
    }
  }

  return { load: candidate, score: Math.min(1, score), signals };
}

export async function matchLoad(classification: ClassificationInput, tenantId: string, db: DB): Promise<LoadMatchResult> {
  const queryTokens: string[] = [];
  maybeAdd(queryTokens, classification.extractedLoadNumber);
  maybeAdd(queryTokens, classification.extractedPoNumber);
  maybeAdd(queryTokens, classification.extractedCustomer);

  const whereClauses = queryTokens
    .map((token) => {
      const q = `%${token}%`;
      return or(ilike(loads.loadNumber, q), ilike(loads.poNumber, q), ilike(loads.customerName, q));
    })
    .filter(Boolean);

  const candidates = await db.query.loads.findMany({
    where: whereClauses.length > 0
      ? and(eq(loads.tenantId, tenantId), or(...whereClauses))
      : eq(loads.tenantId, tenantId),
    limit: 40,
  });

  const ranked = candidates
    .map((load) => computeScore(load, classification))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0] ?? null;
  const alternates = ranked.slice(1, 4).map((r) => r.load);

  return {
    load: winner?.load ?? null,
    confidence: winner?.score ?? 0,
    matchedBy: winner?.signals ?? [],
    alternates,
    requiresReview: (winner?.score ?? 0) < 0.75,
  };
}
