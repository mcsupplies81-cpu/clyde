'use client';

import { FormEvent, useMemo, useState } from 'react';

type RuleCategory = 'safety' | 'tone' | 'workflow' | 'pricing' | 'status';

type SopRule = {
  id: string;
  name: string;
  category: RuleCategory;
  rule_text: string;
  require_approval: boolean;
  is_active: boolean;
};

const seedRules: SopRule[] = [
  { id: crypto.randomUUID(), name: 'Never auto-send detention/accessorial replies', category: 'pricing', rule_text: 'Never auto-send detention/accessorial replies.', require_approval: true, is_active: true },
  { id: crypto.randomUUID(), name: 'Escalate high-risk loads', category: 'safety', rule_text: 'Escalate high-risk loads to an operations lead.', require_approval: true, is_active: true },
  { id: crypto.randomUUID(), name: 'POD handling', category: 'workflow', rule_text: 'If POD is missing, do not say it is attached.', require_approval: false, is_active: true },
  { id: crypto.randomUUID(), name: 'Tracking stale response', category: 'status', rule_text: 'If tracking is stale, say we are confirming with the carrier.', require_approval: false, is_active: true },
  { id: crypto.randomUUID(), name: 'Angry customer route', category: 'tone', rule_text: 'For angry customer emails, route to manager review.', require_approval: true, is_active: true },
  { id: crypto.randomUUID(), name: 'Rate confidentiality', category: 'pricing', rule_text: 'Do not mention internal carrier rate.', require_approval: false, is_active: true },
  { id: crypto.randomUUID(), name: 'Status request completeness', category: 'status', rule_text: 'Always include load number when replying to status requests.', require_approval: false, is_active: true },
  { id: crypto.randomUUID(), name: 'Quote brevity', category: 'workflow', rule_text: 'Keep quote replies short and confirm lane/date/equipment.', require_approval: false, is_active: true }
];

const categories: RuleCategory[] = ['safety', 'tone', 'workflow', 'pricing', 'status'];

const emptyForm = {
  name: '',
  category: 'workflow' as RuleCategory,
  rule_text: '',
  require_approval: false,
  is_active: true
};

export default function RulesPage() {
  const [rules, setRules] = useState<SopRule[]>(seedRules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const activeCount = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.rule_text.trim()) {
      return;
    }

    if (editingId) {
      setRules((current) =>
        current.map((rule) =>
          rule.id === editingId
            ? { ...rule, ...form, name: form.name.trim(), rule_text: form.rule_text.trim() }
            : rule
        )
      );
    } else {
      setRules((current) => [
        {
          id: crypto.randomUUID(),
          name: form.name.trim(),
          category: form.category,
          rule_text: form.rule_text.trim(),
          require_approval: form.require_approval,
          is_active: form.is_active
        },
        ...current
      ]);
    }

    setEditingId(null);
    setForm(emptyForm);
  };

  return (
    <main className="grid">
      <section className="card">
        <h1>SOP Rules</h1>
        <p>Define how Clyde drafts and routes replies.</p>
        <p><strong>{activeCount}</strong> active of <strong>{rules.length}</strong> rules.</p>
      </section>

      <section className="card">
        <h2>{editingId ? 'Edit SOP Rule' : 'Create SOP Rule'}</h2>
        <form onSubmit={onSubmit} className="grid">
          <div className="row">
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} required />
            </label>
            <label>
              Category
              <select value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value as RuleCategory }))}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
          </div>
          <label>
            Rule text
            <textarea value={form.rule_text} onChange={(e) => setForm((current) => ({ ...current, rule_text: e.target.value }))} required />
          </label>
          <div className="row">
            <label>
              <input type="checkbox" checked={form.require_approval} onChange={(e) => setForm((current) => ({ ...current, require_approval: e.target.checked }))} /> Require approval
            </label>
            <label>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))} /> Active
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{editingId ? 'Save changes' : 'Create rule'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button> : null}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Active SOP Rules</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Rule</th><th>Approval</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{rule.category}</td>
                <td>{rule.rule_text}</td>
                <td>{rule.require_approval ? 'Required' : 'Not required'}</td>
                <td><span className={`badge ${rule.is_active ? 'active' : 'inactive'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => { setEditingId(rule.id); setForm({ name: rule.name, category: rule.category, rule_text: rule.rule_text, require_approval: rule.require_approval, is_active: rule.is_active }); }}>Edit</button>
                  <button type="button" onClick={() => setRules((current) => current.map((entry) => entry.id === rule.id ? { ...entry, is_active: !entry.is_active } : entry))}>
                    {rule.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
