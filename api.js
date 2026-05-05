import express from "express";
import { runLegalAgent } from "../src/agent.js";

export const router = express.Router();

// In-memory session store (use Redis in production)
const sessions = new Map();

/**
 * POST /api/analyze
 * Quick one-shot contract analysis — no session needed.
 *
 * Body: { contract_text: string, contract_type?: string, client_party?: string }
 */
router.post("/analyze", async (req, res) => {
  const { contract_text, contract_type = "unknown", client_party = "client" } = req.body;

  if (!contract_text) {
    return res.status(400).json({ error: "contract_text is required" });
  }

  try {
    const prompt = `
Please analyze the following contract. Use all available tools in parallel:
1. analyze_contract — structural overview
2. extract_key_data — parties, dates, key terms
3. classify_risks — risk assessment

Contract type: ${contract_type}
Client party: ${client_party}

--- CONTRACT START ---
${contract_text}
--- CONTRACT END ---

After running the tools, provide a clear, structured report with:
- Executive summary (2-3 sentences)
- Key data extracted
- Risk findings sorted by severity
- Top 3 recommended actions
    `.trim();

    const result = await runLegalAgent(prompt);
    res.json({
      analysis: result.response,
      usage: result.usage,
      session_id: null, // one-shot, no session
    });
  } catch (err) {
    console.error("[/analyze]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat
 * Multi-turn session for follow-up questions, clause redrafting, etc.
 *
 * Body: { message: string, session_id?: string }
 */
router.post("/chat", async (req, res) => {
  const { message, session_id } = req.body;

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  // Load or create session history
  const history = session_id && sessions.has(session_id)
    ? sessions.get(session_id)
    : [];

  try {
    const result = await runLegalAgent(message, history);

    // Save updated history
    const newSessionId = session_id || crypto.randomUUID();
    sessions.set(newSessionId, result.history);

    res.json({
      response: result.response,
      session_id: newSessionId,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[/chat]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/redraft
 * Dedicated endpoint to redraft a specific clause.
 *
 * Body: { clause: string, context?: string, style?: "balanced"|"client_favorable"|"aggressive" }
 */
router.post("/redraft", async (req, res) => {
  const { clause, context = "", style = "balanced" } = req.body;

  if (!clause) {
    return res.status(400).json({ error: "clause is required" });
  }

  try {
    const prompt = `
Please redraft the following contract clause using the redraft_clause tool.
Style: ${style}
Context: ${context || "General commercial contract"}

Clause:
"${clause}"

After using the tool, provide 2-3 alternative versions with a clear explanation of each improvement.
    `.trim();

    const result = await runLegalAgent(prompt);
    res.json({ alternatives: result.response, usage: result.usage });
  } catch (err) {
    console.error("[/redraft]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/compare
 * Compare two contract versions.
 *
 * Body: { version_a: string, version_b: string }
 */
router.post("/compare", async (req, res) => {
  const { version_a, version_b } = req.body;

  if (!version_a || !version_b) {
    return res.status(400).json({ error: "version_a and version_b are required" });
  }

  try {
    const prompt = `
Compare these two contract versions using the compare_versions tool and explain the legal impact of all changes.

VERSION A:
${version_a}

VERSION B:
${version_b}

After comparing, list each change with:
- What changed (clause/section)
- Whether the change is favorable, unfavorable, or neutral for the client
- Recommended action (accept / negotiate / reject)
    `.trim();

    const result = await runLegalAgent(prompt);
    res.json({ comparison: result.response, usage: result.usage });
  } catch (err) {
    console.error("[/compare]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/template
 * Generate a contract template.
 *
 * Body: { contract_type: string, jurisdiction?: string, language?: string }
 */
router.post("/template", async (req, res) => {
  const { contract_type, jurisdiction = "Spain", language = "es" } = req.body;

  if (!contract_type) {
    return res.status(400).json({ error: "contract_type is required" });
  }

  try {
    const prompt = `
Use the search_legal_templates tool to find the right template for a ${contract_type} contract.
Jurisdiction: ${jurisdiction}
Language: ${language}

After retrieving the template structure, draft a complete contract template with:
- All standard sections filled in with reasonable defaults
- Clear [PLACEHOLDER] markers for fields the user must customize
- A brief note after each section explaining what to pay attention to
    `.trim();

    const result = await runLegalAgent(prompt);
    res.json({ template: result.response, usage: result.usage });
  } catch (err) {
    console.error("[/template]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/session/:id
 * Clear a conversation session.
 */
router.delete("/session/:id", (req, res) => {
  sessions.delete(req.params.id);
  res.json({ deleted: true });
});
