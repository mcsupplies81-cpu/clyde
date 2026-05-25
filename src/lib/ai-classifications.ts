import type { MatchResult } from './load-matching';

export type AiClassificationRecord = {
  messageId: string;
  loadMatch: Pick<MatchResult, 'confidence' | 'matchedBy' | 'reasoning'> & {
    matchedLoadId: string | null;
  };
  createdAt: string;
};

const memoryStore = new Map<string, AiClassificationRecord>();

export async function saveLoadMatchClassification(
  messageId: string,
  result: MatchResult,
): Promise<AiClassificationRecord> {
  const record: AiClassificationRecord = {
    messageId,
    loadMatch: {
      matchedLoadId: result.matchedLoad?.id ?? null,
      confidence: result.confidence,
      matchedBy: result.matchedBy,
      reasoning: result.reasoning,
    },
    createdAt: new Date().toISOString(),
  };

  memoryStore.set(messageId, record);
  return record;
}

export async function getLoadMatchClassification(messageId: string): Promise<AiClassificationRecord | null> {
  return memoryStore.get(messageId) ?? null;
}
