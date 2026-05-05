/**
 * Tool definitions passed to the Claude API.
 * Each tool corresponds to a handler in toolHandlers.js
 */
export const tools = [
  {
    name: "analyze_contract",
    description:
      "Performs a full structural analysis of a contract: identifies all clauses, their types, and flags any that are unusual, missing, or potentially problematic. Returns a structured breakdown.",
    input_schema: {
      type: "object",
      properties: {
        contract_text: {
          type: "string",
          description: "The full text of the contract to analyze",
        },
        contract_type: {
          type: "string",
          enum: ["services", "saas", "nda", "employment", "procurement", "partnership", "unknown"],
          description: "The type of contract. Use 'unknown' if unsure.",
        },
        client_party: {
          type: "string",
          description: "Which party is the client / our side (e.g. 'buyer', 'licensee', 'employer')",
        },
      },
      required: ["contract_text"],
    },
  },
  {
    name: "extract_key_data",
    description:
      "Extracts structured key data from a contract: parties, effective date, duration, payment terms, SLAs, penalties, termination rights, IP ownership, governing law.",
    input_schema: {
      type: "object",
      properties: {
        contract_text: {
          type: "string",
          description: "The full text of the contract",
        },
      },
      required: ["contract_text"],
    },
  },
  {
    name: "classify_risks",
    description:
      "Scans a contract for known risk patterns and classifies each finding as HIGH, MEDIUM, or LOW risk. Risk patterns include: uncapped liability, unilateral amendment rights, IP assignment to vendor, automatic renewal, non-compete, data ownership, one-sided termination.",
    input_schema: {
      type: "object",
      properties: {
        contract_text: {
          type: "string",
          description: "The full text of the contract",
        },
        focus_areas: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of specific risk areas to focus on (e.g. ['liability', 'ip', 'data'])",
        },
      },
      required: ["contract_text"],
    },
  },
  {
    name: "redraft_clause",
    description:
      "Rewrites a specific contract clause to be more balanced or favorable to the client. Returns 2-3 alternative versions with a short explanation of the improvement.",
    input_schema: {
      type: "object",
      properties: {
        original_clause: {
          type: "string",
          description: "The exact text of the clause to redraft",
        },
        clause_context: {
          type: "string",
          description: "Brief context: what type of contract, who is the client, what outcome is desired",
        },
        style: {
          type: "string",
          enum: ["balanced", "client_favorable", "aggressive"],
          description: "How strongly to push in favor of the client",
        },
      },
      required: ["original_clause"],
    },
  },
  {
    name: "compare_versions",
    description:
      "Compares two versions of a contract and returns a list of all changes with their legal significance. Highlights additions, removals, and modifications.",
    input_schema: {
      type: "object",
      properties: {
        version_a: {
          type: "string",
          description: "The original (older) version of the contract",
        },
        version_b: {
          type: "string",
          description: "The revised (newer) version of the contract",
        },
      },
      required: ["version_a", "version_b"],
    },
  },
  {
    name: "search_legal_templates",
    description:
      "Returns a suitable contract template for the requested type, with standard clauses pre-filled and placeholders for key variables.",
    input_schema: {
      type: "object",
      properties: {
        contract_type: {
          type: "string",
          description: "Type of contract needed (e.g. 'NDA', 'SaaS subscription', 'consulting services', 'employment')",
        },
        jurisdiction: {
          type: "string",
          description: "Target jurisdiction or country (e.g. 'Spain', 'United Kingdom', 'EU')",
        },
        language: {
          type: "string",
          enum: ["es", "en", "fr", "de"],
          description: "Language of the template",
        },
      },
      required: ["contract_type"],
    },
  },
];
