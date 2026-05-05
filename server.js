import express from "express";
import { router } from "./routes/api.js";

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" })); // contracts can be large
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Mount the agent API
app.use("/api", router);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", agent: "legal-reviewer" }));

app.listen(PORT, () => {
  console.log(`\n⚖️  Legal Reviewer Agent running on http://localhost:${PORT}`);
  console.log("   Endpoints:");
  console.log("   POST /api/analyze   — one-shot full contract analysis");
  console.log("   POST /api/chat      — multi-turn conversation");
  console.log("   POST /api/redraft   — redraft a specific clause");
  console.log("   POST /api/compare   — compare two contract versions");
  console.log("   POST /api/template  — generate a contract template");
  console.log("   DELETE /api/session/:id — clear a session\n");
});
