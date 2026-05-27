"use client";

import { useActionState, useState } from "react";

type ExistingKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
};

type CreateResult = { key: string; prefix: string; name: string } | { error: string } | undefined;
type RevokeResult = { ok: boolean } | { error: string } | undefined;

export function ApiKeySection({
  existingKeys,
  createAction,
  revokeAction,
}: {
  existingKeys: ExistingKey[];
  createAction: (prev: CreateResult, fd: FormData) => Promise<CreateResult>;
  revokeAction: (prev: RevokeResult, fd: FormData) => Promise<RevokeResult>;
}) {
  const [createResult, createFormAction, creating] = useActionState<CreateResult, FormData>(createAction, undefined);
  const [, revokeFormAction] = useActionState<RevokeResult, FormData>(revokeAction, undefined);
  const [showForm, setShowForm] = useState(false);

  const newKey = createResult && "key" in createResult ? createResult : null;
  const createError = createResult && "error" in createResult ? createResult.error : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Existing keys */}
      {existingKeys.map((k) => (
        <div key={k.id} style={rowStyle}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#292929", display: "flex", alignItems: "center", gap: 8 }}>
              <code style={codeStyle}>{k.keyPrefix}••••••••</code>
              {k.name}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
              Created {new Date(k.createdAt).toLocaleDateString()}
              {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · Never used"}
            </div>
          </div>
          <form action={revokeFormAction}>
            <input type="hidden" name="keyId" value={k.id} />
            <button type="submit" style={dangerBtnStyle}>Revoke</button>
          </form>
        </div>
      ))}

      {existingKeys.length === 0 && !showForm && (
        <div style={{ ...rowStyle, color: "#9CA3AF", fontSize: 12 }}>No API keys yet.</div>
      )}

      {/* Newly generated key — show once */}
      {newKey && (
        <div style={{ margin: "10px 0", padding: "12px 14px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#15803D", marginBottom: 6 }}>
            ✓ Key generated for &quot;{newKey.name}&quot; - copy it now, it won&apos;t be shown again
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ ...codeStyle, fontSize: 12, padding: "6px 10px", flex: 1, userSelect: "all" as const }}>
              {newKey.key}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(newKey.key)}
              style={btnStyle}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {createError && (
        <div style={{ color: "#DC2626", fontSize: 12, padding: "8px 0" }}>{createError}</div>
      )}

      {/* Create form */}
      {showForm ? (
        <form action={createFormAction} style={{ ...rowStyle, flexDirection: "column" as const, alignItems: "stretch", gap: 8 }}>
          <input
            name="keyName"
            placeholder='Key name, e.g. "Rose Rocket" or "Production"'
            required
            autoFocus
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={creating} style={{ ...btnStyle, opacity: creating ? 0.6 : 1 }}>
              {creating ? "Generating…" : "Generate Key"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={cancelBtnStyle}>Cancel</button>
          </div>
        </form>
      ) : (
        <div style={rowStyle}>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>
            Keys are shown once at creation. Store them securely.
          </div>
          <button type="button" onClick={() => setShowForm(true)} style={btnStyle}>
            + Generate Key
          </button>
        </div>
      )}
    </div>
  );
}

const rowStyle = { display: "flex" as const, justifyContent: "space-between" as const, alignItems: "center" as const, gap: 16, padding: "10px 0", borderTop: "1px solid #F2F2F2" };
const codeStyle = { background: "#F5F5F5", border: "1px solid #E8E8E8", borderRadius: 5, padding: "3px 7px", color: "#2563EB", fontSize: 11, fontFamily: "monospace" };
const inputStyle = { background: "#FAFAF8", border: "1px solid #E8E8E8", borderRadius: 6, color: "#292929", padding: "7px 10px", fontSize: 12, outline: "none", width: "100%" };
const btnStyle = { background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" } as const;
const cancelBtnStyle = { background: "transparent", color: "#9CA3AF", border: "1px solid #E8E8E8", borderRadius: 6, padding: "7px 12px", fontSize: 12, cursor: "pointer" } as const;
const dangerBtnStyle = { background: "transparent", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" } as const;
