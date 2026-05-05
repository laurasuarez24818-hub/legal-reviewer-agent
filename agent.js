import Anthropic from "@anthropic-ai/sdk";
import { LEGAL_SYSTEM_PROMPT } from "../prompts/system.js";
import { tools } from "./tools.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Runs the Legal Reviewer agent with a full agentic loop.
 * Keeps calling Claude until it returns a final text response
 * (no more tool_use blocks).
 *
 * @param {string} userMessage - The user's request (may include contract text)
 * @param {Array}  history     - Prior conversation turns for multi-turn sessions
 * @returns {Promise<{response: string, history: Array, usage: object}>}
 */
export async function runLegalAgent(userMessage, history = []) {
  const messages = [
    ...history,
    { role: "user", content: userMessage },
  ];

  let totalUsage = { input_tokens: 0, output_tokens: 0 };

  // Agentic loop — continues until Claude stops requesting tool calls
  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: LEGAL_SYSTEM_PROMPT,
      tools,
      messages,
    });

    totalUsage.input_tokens  += response.usage.input_tokens;
    totalUsage.output_tokens += response.usage.output_tokens;

    // Append Claude's full response to the conversation
    messages.push({ role: "assistant", content: response.content });

    // If Claude is done, return the final text
    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return { response: text, history: messages, usage: totalUsage };
    }

    // If Claude wants to use tools, execute them and append results
    if (response.stop_reason === "tool_use") {
      const toolResults = await executeTools(response.content);
      messages.push({ role: "user", content: toolResults });
      // Loop continues → Claude sees the results and keeps reasoning
    }
  }
}

/**
 * Execute all tool_use blocks in parallel and return tool_result blocks.
 */
async function executeTools(contentBlocks) {
  const { toolHandlers } = await import("./toolHandlers.js");

  const results = await Promise.all(
    contentBlocks
      .filter((b) => b.type === "tool_use")
      .map(async (toolUse) => {
        console.log(`[agent] calling tool: ${toolUse.name}`, toolUse.input);
        try {
          const handler = toolHandlers[toolUse.name];
          if (!handler) throw new Error(`Unknown tool: ${toolUse.name}`);
          const output = await handler(toolUse.input);
          return {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(output),
          };
        } catch (err) {
          return {
            type: "tool_result",
            tool_use_id: toolUse.id,
            is_error: true,
            content: err.message,
          };
        }
      })
  );

  return results;
}
