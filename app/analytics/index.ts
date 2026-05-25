import { neonSeededThreads, type EmailCategory, type Priority, type RiskLevel } from "../data/neonDemo";

type CountMap<T extends string> = Record<T, number>;

interface AnalyticsMetrics {
  totalInboundEmails: number;
  emailsClassified: number;
  draftsGenerated: number;
  draftsApproved: number;
  threadsResolved: number;
  escalatedThreads: number;
  averageConfidence: number;
  emailsByCategory: CountMap<EmailCategory>;
  openThreadsByPriority: CountMap<Priority>;
  loadsByRiskLevel: CountMap<RiskLevel>;
}

const emptyCategories: CountMap<EmailCategory> = {
  Billing: 0,
  Technical: 0,
  Onboarding: 0,
  Sales: 0,
  Account: 0
};

const emptyPriorities: CountMap<Priority> = { P1: 0, P2: 0, P3: 0 };
const emptyRisks: CountMap<RiskLevel> = { Low: 0, Medium: 0, High: 0 };

export function computeAnalytics(): AnalyticsMetrics {
  const metrics: AnalyticsMetrics = {
    totalInboundEmails: 0,
    emailsClassified: 0,
    draftsGenerated: 0,
    draftsApproved: 0,
    threadsResolved: 0,
    escalatedThreads: 0,
    averageConfidence: 0,
    emailsByCategory: { ...emptyCategories },
    openThreadsByPriority: { ...emptyPriorities },
    loadsByRiskLevel: { ...emptyRisks }
  };

  let confidenceTotal = 0;

  for (const thread of neonSeededThreads) {
    metrics.totalInboundEmails += thread.inboundEmails;
    if (thread.classified) metrics.emailsClassified += 1;
    if (thread.draftGenerated) metrics.draftsGenerated += 1;
    if (thread.draftApproved) metrics.draftsApproved += 1;
    if (thread.resolved) metrics.threadsResolved += 1;
    if (thread.escalated) metrics.escalatedThreads += 1;

    metrics.emailsByCategory[thread.category] += thread.inboundEmails;
    if (!thread.resolved) metrics.openThreadsByPriority[thread.priority] += 1;
    metrics.loadsByRiskLevel[thread.riskLevel] += 1;

    confidenceTotal += thread.confidence;
  }

  metrics.averageConfidence = neonSeededThreads.length === 0 ? 0 : confidenceTotal / neonSeededThreads.length;
  return metrics;
}

export function renderAnalyticsHtml(): string {
  const metrics = computeAnalytics();
  const recentActivity = [...neonSeededThreads]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);

  const metricCard = (label: string, value: string | number) => `
    <article class="metric-card">
      <h3>${label}</h3>
      <p>${value}</p>
    </article>`;

  return `
<section class="analytics">
  <style>
    .analytics { font-family: Inter, Arial, sans-serif; color: #111827; display: grid; gap: 1rem; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; }
    .metric-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: .75rem; background: #fff; }
    .metric-card h3 { margin: 0; color: #4b5563; font-size: .85rem; font-weight: 600; }
    .metric-card p { margin: .3rem 0 0; font-size: 1.15rem; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: .5rem; }
    .summary-cards { display: grid; grid-template-columns: repeat(2, minmax(240px, 1fr)); gap: .75rem; }
    ul { margin: 0; padding-left: 1.1rem; }
  </style>

  <header>
    <h2>Clyde Email Operations Analytics</h2>
    <p>Tracks reduced manual handling, faster response workflows, and exception visibility using Neon seeded/demo records.</p>
  </header>

  <div class="metrics-grid">
    ${metricCard("Total inbound emails", metrics.totalInboundEmails)}
    ${metricCard("Emails classified", metrics.emailsClassified)}
    ${metricCard("Drafts generated", metrics.draftsGenerated)}
    ${metricCard("Drafts approved", metrics.draftsApproved)}
    ${metricCard("Threads resolved", metrics.threadsResolved)}
    ${metricCard("Escalated threads", metrics.escalatedThreads)}
    ${metricCard("Average confidence", `${(metrics.averageConfidence * 100).toFixed(1)}%`)}
  </div>

  <section>
    <h3>Emails by Category</h3>
    <table>
      <thead><tr><th>Category</th><th>Inbound Email Load</th></tr></thead>
      <tbody>
        ${Object.entries(metrics.emailsByCategory).map(([category, count]) => `<tr><td>${category}</td><td>${count}</td></tr>`).join("")}
      </tbody>
    </table>
  </section>

  <section class="summary-cards">
    <article class="metric-card">
      <h3>Open Threads by Priority</h3>
      <ul>${Object.entries(metrics.openThreadsByPriority).map(([p, c]) => `<li>${p}: ${c}</li>`).join("")}</ul>
    </article>
    <article class="metric-card">
      <h3>Loads by Risk Level</h3>
      <ul>${Object.entries(metrics.loadsByRiskLevel).map(([r, c]) => `<li>${r}: ${c}</li>`).join("")}</ul>
    </article>
  </section>

  <section>
    <h3>Recent AI Activity</h3>
    <ul>
      ${recentActivity.map((row) => `<li><strong>${row.threadId}</strong> — ${row.activity} (${new Date(row.timestamp).toISOString()})</li>`).join("")}
    </ul>
  </section>
</section>`;
}
