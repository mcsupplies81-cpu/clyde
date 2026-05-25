export function draftReplyWidget() {
  return `
<div class="draft-reply-widget">
  <button id="generate-draft">Generate draft</button>
  <div id="draft-preview" style="display:none;border:1px solid #ccc;padding:12px;margin-top:8px;">
    <h4>Draft preview</h4>
    <p><strong>Subject:</strong> <span id="draft-subject"></span></p>
    <textarea id="draft-body" rows="8" style="width:100%"></textarea>
    <div style="margin-top:8px;display:flex;gap:8px;">
      <button id="approve-draft">Approve draft</button>
      <button id="reject-draft">Reject draft</button>
    </div>
  </div>
</div>`;
}
