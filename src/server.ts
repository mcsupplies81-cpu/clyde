import express from "express";
import { postDraftReply } from "./api/draftReply.js";
import { seed } from "./lib/data.js";
import { draftReplyWidget } from "./ui/draftReply.js";

const app = express();
app.use(express.json());
seed();

app.post("/api/ai/draft-reply", postDraftReply);
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html><html><body>${draftReplyWidget()}</body></html>`);
});

app.listen(3000);
