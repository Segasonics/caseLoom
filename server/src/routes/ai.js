import express from "express";
import { Case } from "../models/Case.js";
import { TimelineEvent } from "../models/TimelineEvent.js";
import { DecisionPoint } from "../models/DecisionPoint.js";
import { requireAuth } from "../middleware/auth.js";
import { findAccessibleCase } from "../utils/access.js";

const router = express.Router();

const OPENAI_URL = "https://api.openai.com/v1/responses";

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "OPENAI_API_KEY is not set" };
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const temperature = Number(process.env.OPENAI_TEMPERATURE);
  return {
    apiKey,
    model,
    temperature: Number.isFinite(temperature) ? temperature : undefined
  };
}

function extractOutputText(response) {
  if (response?.output_text) return response.output_text;
  if (!Array.isArray(response?.output)) return "";
  for (const item of response.output) {
    if (item?.type !== "message") continue;
    const content = item.content || [];
    for (const part of content) {
      if (part?.type === "output_text" && part.text) return part.text;
      if (part?.type === "text" && part.text) return part.text;
    }
  }
  return "";
}

async function callOpenAi({ instructions, input }) {
  const config = getOpenAiConfig();
  if (config.error) {
    return { error: config.error };
  }

  const body = {
    model: config.model,
    input,
    instructions
  };

  if (config.temperature !== undefined) {
    body.temperature = config.temperature;
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || "OpenAI request failed";
    return { error: message };
  }

  const text = extractOutputText(json);
  if (!text) {
    return { error: "OpenAI returned empty output" };
  }
  return { text, model: config.model };
}

function buildCaseContext({ caseItem, timeline, decisions }) {
  const timelineLines = timeline.map((item) => {
    const when = item.occurredAt ? new Date(item.occurredAt).toISOString() : "unknown";
    return `- ${when} | ${item.kind}: ${item.description}`;
  });

  const decisionLines = decisions.map((item) => {
    const when = item.createdAt ? new Date(item.createdAt).toISOString() : "unknown";
    const followUp = item.followUpBy ? new Date(item.followUpBy).toISOString() : "none";
    return `- ${when} | ${item.decisionType}: ${item.rationale} | next: ${item.nextStep} | follow-up: ${followUp}`;
  });

  return [
    `Case Title: ${caseItem.title}`,
    `Patient Alias: ${caseItem.patientAlias}`,
    `Case Summary: ${caseItem.summary || "none"}`,
    `Status: ${caseItem.status}`,
    `Timeline:`,
    timelineLines.length ? timelineLines.join("\n") : "- none",
    `Decision Points:`,
    decisionLines.length ? decisionLines.join("\n") : "- none"
  ].join("\n");
}

router.use(requireAuth);

router.post("/case-summary", async (req, res) => {
  const { caseId } = req.body;
  if (!caseId) {
    return res.status(400).json({ error: "caseId is required" });
  }

  const caseItem = await findAccessibleCase(req.user, caseId, { lean: false });
  if (!caseItem) {
    return res.status(404).json({ error: "Case not found" });
  }

  const timeline = await TimelineEvent.find({ caseId }).sort({ occurredAt: 1 }).limit(50);
  const decisions = await DecisionPoint.find({ caseId }).sort({ createdAt: 1 }).limit(50);
  const context = buildCaseContext({ caseItem, timeline, decisions });

  const instructions = [
    "You are a clinical assistant.",
    "Generate a concise case summary using de-identified information only.",
    "Focus on key symptoms, tests, decisions, and follow-ups.",
    "Keep it under 120 words and use clear sentences."
  ].join(" ");

  const result = await callOpenAi({ instructions, input: context });
  if (result.error) {
    return res.status(500).json({ error: result.error });
  }

  caseItem.aiSummary = result.text.trim();
  caseItem.aiSummaryUpdatedAt = new Date();
  caseItem.aiSummaryModel = result.model || "";
  await caseItem.save();

  return res.json({
    aiSummary: caseItem.aiSummary,
    aiSummaryUpdatedAt: caseItem.aiSummaryUpdatedAt,
    aiSummaryModel: caseItem.aiSummaryModel
  });
});

router.post("/decision-draft", async (req, res) => {
  const { caseId, decisionType } = req.body;
  if (!caseId || !decisionType) {
    return res.status(400).json({ error: "caseId and decisionType are required" });
  }

  const caseItem = await findAccessibleCase(req.user, caseId, { lean: false });
  if (!caseItem) {
    return res.status(404).json({ error: "Case not found" });
  }

  const timeline = await TimelineEvent.find({ caseId }).sort({ occurredAt: 1 }).limit(50);
  const decisions = await DecisionPoint.find({ caseId }).sort({ createdAt: 1 }).limit(20);
  const context = buildCaseContext({ caseItem, timeline, decisions });

  const instructions = [
    "You are a clinical assistant.",
    "Draft a decision rationale and a next step for the given decision type.",
    "Return exactly two lines:",
    "Rationale: <text>",
    "NextStep: <text>",
    "Keep it concise and de-identified."
  ].join(" ");

  const input = `${context}\nDecision Type Requested: ${decisionType}`;
  const result = await callOpenAi({ instructions, input });
  if (result.error) {
    return res.status(500).json({ error: result.error });
  }

  let rationaleDraft = "";
  let nextStepDraft = "";
  const lines = result.text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.toLowerCase().startsWith("rationale:")) {
      rationaleDraft = line.split(":").slice(1).join(":").trim();
    } else if (line.toLowerCase().startsWith("nextstep:")) {
      nextStepDraft = line.split(":").slice(1).join(":").trim();
    }
  }

  if (!rationaleDraft) {
    rationaleDraft = result.text.trim();
  }

  return res.json({ rationaleDraft, nextStepDraft });
});

export default router;
