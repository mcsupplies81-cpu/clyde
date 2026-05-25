export type LoadMatchPanelData = {
  matchedLoadId: string | null;
  confidence: number;
  matchedBy: string;
  reasoning: string;
};

export function LoadMatchConfidence({ data }: { data: LoadMatchPanelData | null }) {
  if (!data) {
    return (
      <section aria-label="load-match-confidence">
        <h3>Load match</h3>
        <p>No match run yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="load-match-confidence">
      <h3>Load match</h3>
      <p>Confidence: {(data.confidence * 100).toFixed(0)}%</p>
      <p>Matched by: {data.matchedBy}</p>
      <p>Load ID: {data.matchedLoadId ?? 'No load matched'}</p>
      <p>{data.reasoning}</p>
    </section>
  );
}
