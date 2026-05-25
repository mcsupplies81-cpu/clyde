import type { Request, Response } from "express";
import { generateFreightDraft } from "../lib/draft.js";
import { getActiveSopRules, getClassification, getLoad, getMessage, saveDraft } from "../lib/data.js";

export async function postDraftReply(req: Request, res: Response): Promise<void> {
  const { messageId, classificationId, loadId } = req.body as { messageId?: string; classificationId?: string; loadId?: string };
  if (!messageId || !classificationId || !loadId) {
    res.status(400).json({ error: "messageId, classificationId, and loadId are required" });
    return;
  }

  const message = await getMessage(messageId);
  const classification = await getClassification(classificationId);
  if (!message || !classification) {
    res.status(404).json({ error: "Message or classification not found" });
    return;
  }

  const load = await getLoad(loadId);
  const sopRules = await getActiveSopRules(message.tenantId, classification.category);

  const draft = await generateFreightDraft({ message, classification, load, sopRules });
  await saveDraft(draft);

  res.json({
    draftSubject: draft.draftSubject,
    draftBody: draft.draftBody,
    confidence: draft.confidence,
    approvalRequired: true,
    reasoning: draft.reasoning
  });
}
