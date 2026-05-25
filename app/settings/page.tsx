const sectionStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: 12,
  background: '#f8fafc',
};

export default function SettingsPage() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>Demo Settings</h1>

      <section style={sectionStyle}>
        <h2>1) Company profile</h2>
        <ul>
          <li><strong>Tenant name:</strong> Acme Logistics Demo</li>
          <li><strong>Demo inbox:</strong> demo-inbox@acme-logistics.example</li>
          <li><strong>Timezone:</strong> America/Chicago</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>2) AI settings</h2>
        <ul>
          <li><strong>Approval required for all drafts:</strong> true</li>
          <li><strong>Model provider label:</strong> OpenAI (Demo)</li>
          <li><strong>Classification enabled:</strong> true</li>
          <li><strong>Draft generation enabled:</strong> true</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>3) Integration status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={cardStyle}><strong>Gmail</strong><div>not connected</div></div>
          <div style={cardStyle}><strong>Outlook</strong><div>not connected</div></div>
          <div style={cardStyle}><strong>TMS</strong><div>mock data</div></div>
          <div style={cardStyle}><strong>Tracking</strong><div>mock data</div></div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>4) Danger/demo tools</h2>
        <p><strong>Re-seed demo data:</strong> Run the local seed script to repopulate sample tenants, inboxes, and messages for demos.</p>
        <p><strong>Reset demo note:</strong> This reset is for demo environments only. Do not use with production data.</p>
      </section>
    </main>
  );
}
