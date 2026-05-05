/**
 * Tool handler implementations.
 * In production these would call real services (databases, external APIs, etc.).
 * Each handler receives the input object Claude sends and returns a result object.
 */

export const toolHandlers = {
  /**
   * Structural analysis of a contract.
   * In production: use a document parser + your own clause database.
   */
  analyze_contract: async ({ contract_text, contract_type = "unknown", client_party = "client" }) => {
    const wordCount = contract_text.split(/\s+/).length;
    const clauseMatches = contract_text.match(/\b(\d+\.|clause|section|artículo|art\.)\s/gi) || [];
    const estimatedClauses = Math.max(clauseMatches.length, Math.floor(wordCount / 150));

    // Detect common clause types present in the text
    const clauseTypes = {
      "Payment terms":       /payment|fee|invoice|precio|pago/i.test(contract_text),
      "Liability":           /liabilit|responsabilidad|daños/i.test(contract_text),
      "Intellectual property": /intellectual property|propiedad intelectual|IP rights/i.test(contract_text),
      "Confidentiality":     /confidential|NDA|secreto/i.test(contract_text),
      "Termination":         /terminat|resolución|rescisión/i.test(contract_text),
      "Governing law":       /governing law|jurisdiction|fuero|ley aplicable/i.test(contract_text),
      "Force majeure":       /force majeure|caso fortuito|fuerza mayor/i.test(contract_text),
      "Data protection":     /GDPR|data protection|protección de datos|privacy/i.test(contract_text),
      "Non-compete":         /non.compete|no competencia|competencia/i.test(contract_text),
      "SLA":                 /SLA|service level|nivel de servicio/i.test(contract_text),
    };

    const presentClauses = Object.entries(clauseTypes)
      .filter(([, found]) => found)
      .map(([name]) => name);

    const missingClauses = Object.entries(clauseTypes)
      .filter(([, found]) => !found)
      .map(([name]) => name);

    return {
      contract_type,
      client_party,
      word_count: wordCount,
      estimated_clauses: estimatedClauses,
      clauses_detected: presentClauses,
      clauses_missing: missingClauses,
      analysis_note: `Contract appears to be a ${contract_type} agreement with ${estimatedClauses} estimated clauses. ${missingClauses.length} standard clause types not detected.`,
    };
  },

  /**
   * Extract key structured data from a contract.
   */
  extract_key_data: async ({ contract_text }) => {
    // Regex-based extraction for common patterns
    // In production: use a fine-tuned extraction model or Claude with structured output
    const extract = (pattern, fallback = "Not specified") => {
      const m = contract_text.match(pattern);
      return m ? m[1]?.trim() : fallback;
    };

    return {
      parties: {
        party_a: extract(/between\s+([A-Z][^,]+),/i) || extract(/entre\s+([^,]+),/i),
        party_b: extract(/and\s+([A-Z][^,\n]+)(?:,|\n)/i) || extract(/y\s+([^,\n]+)(?:,|\n)/i),
      },
      effective_date: extract(/effective\s+(?:date[:\s]+)?(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i) ||
                      extract(/fecha\s+(?:de\s+)?entrada\s+en\s+vigor[:\s]+([^\n]+)/i),
      duration:       extract(/(?:term|duration|plazo)[:\s]+([^\n.]+)/i),
      payment_terms:  extract(/payment\s+terms[:\s]+([^\n.]+)/i) ||
                      extract(/condiciones\s+de\s+pago[:\s]+([^\n.]+)/i),
      governing_law:  extract(/governed\s+by\s+(?:the\s+laws?\s+of\s+)?([^\n.,]+)/i) ||
                      extract(/ley\s+aplicable[:\s]+([^\n.]+)/i),
      auto_renewal:   /auto.renew|renovación\s+automática/i.test(contract_text),
      notice_period:  extract(/notice\s+(?:period\s+of\s+)?(\d+\s+(?:days?|months?))/i) ||
                      extract(/preaviso\s+de\s+(\d+\s+(?:días?|meses?))/i),
    };
  },

  /**
   * Classify risks found in the contract.
   */
  classify_risks: async ({ contract_text, focus_areas = [] }) => {
    const risks = [];

    const riskPatterns = [
      {
        id: "R001",
        level: "HIGH",
        name: "Uncapped vendor liability",
        pattern: /liability.{0,60}unlimited|sin\s+límite.{0,60}responsabilidad/i,
        description: "Vendor's liability appears to be unlimited, which may expose your business to uncapped financial risk.",
        recommendation: "Add a mutual liability cap, typically capped at 12 months of fees paid.",
      },
      {
        id: "R002",
        level: "HIGH",
        name: "Capped client liability",
        pattern: /(?:our|provider|vendor).{0,80}(?:not|no)\s+liable|máxima\s+responsabilidad\s+de/i,
        description: "The contract limits the vendor's liability but not the client's, creating an asymmetric risk.",
        recommendation: "Negotiate a mutual and symmetric liability cap.",
      },
      {
        id: "R003",
        level: "HIGH",
        name: "Unilateral amendment right",
        pattern: /may\s+(?:amend|modify|change)\s+(?:these\s+terms|this\s+agreement)\s+at\s+(?:any\s+time|its\s+discretion)/i,
        description: "The vendor can unilaterally change contract terms, potentially without notice.",
        recommendation: "Require written notice (30+ days) and the right to terminate if changes are material.",
      },
      {
        id: "R004",
        level: "HIGH",
        name: "IP assignment to vendor",
        pattern: /intellectual\s+property.{0,120}(?:assign|belong|vest)\s+to\s+(?:us|provider|company)/i,
        description: "Work product or IP created during the engagement may be assigned to the vendor.",
        recommendation: "Ensure all deliverables and custom IP belong to the client upon payment.",
      },
      {
        id: "R005",
        level: "MEDIUM",
        name: "Auto-renewal clause",
        pattern: /auto(?:matically)?\s+renew|renovación\s+automática/i,
        description: "The contract renews automatically, which could bind you to another term without action.",
        recommendation: "Add a notice-to-cancel period of at least 60 days before renewal date.",
      },
      {
        id: "R006",
        level: "MEDIUM",
        name: "One-sided termination",
        pattern: /(?:we|provider|company)\s+may\s+terminate.{0,100}(?:any\s+time|immediately|without\s+cause)/i,
        description: "Only one party has the right to terminate for convenience, creating an imbalanced arrangement.",
        recommendation: "Negotiate mutual termination for convenience rights with adequate notice.",
      },
      {
        id: "R007",
        level: "MEDIUM",
        name: "Data ownership ambiguity",
        pattern: /data.{0,80}(?:belong|own|retain|property).{0,40}(?:us|provider|company)/i,
        description: "Ownership of client data or data generated from usage is ambiguous or may vest in the vendor.",
        recommendation: "Add an explicit clause: client owns all client data and can export/delete at any time.",
      },
      {
        id: "R008",
        level: "LOW",
        name: "Short confidentiality period",
        pattern: /confidential.{0,60}(?:1\s+year|12\s+months|one\s+year)/i,
        description: "Confidentiality obligations expire after 1 year, which may be insufficient for sensitive information.",
        recommendation: "Consider extending to 3-5 years or making trade secrets perpetual.",
      },
    ];

    for (const rp of riskPatterns) {
      if (focus_areas.length > 0 && !focus_areas.some(a => rp.name.toLowerCase().includes(a.toLowerCase()))) continue;
      if (rp.pattern.test(contract_text)) {
        risks.push({
          id: rp.id,
          level: rp.level,
          name: rp.name,
          description: rp.description,
          recommendation: rp.recommendation,
        });
      }
    }

    const summary = {
      total: risks.length,
      high: risks.filter(r => r.level === "HIGH").length,
      medium: risks.filter(r => r.level === "MEDIUM").length,
      low: risks.filter(r => r.level === "LOW").length,
    };

    return { summary, risks };
  },

  /**
   * Redraft a specific clause.
   */
  redraft_clause: async ({ original_clause, clause_context = "", style = "balanced" }) => {
    // In production: call Claude with a specialized redrafting prompt
    // Here we return a structured placeholder that Claude will use to generate real alternatives
    return {
      original: original_clause,
      context: clause_context,
      style,
      instruction: "Generate 2-3 alternative versions of this clause based on the style and context provided. Each version should include: the rewritten clause text, a one-sentence explanation of what changed and why it is better for the client.",
    };
  },

  /**
   * Compare two contract versions.
   */
  compare_versions: async ({ version_a, version_b }) => {
    const wordsA = version_a.split(/\s+/).length;
    const wordsB = version_b.split(/\s+/).length;
    const lengthChange = wordsB - wordsA;

    // Simple sentence-level diff
    const sentencesA = new Set(version_a.match(/[^.!?]+[.!?]/g) || []);
    const sentencesB = new Set(version_b.match(/[^.!?]+[.!?]/g) || []);

    const added   = [...sentencesB].filter(s => !sentencesA.has(s)).slice(0, 10);
    const removed = [...sentencesA].filter(s => !sentencesB.has(s)).slice(0, 10);

    return {
      version_a_words: wordsA,
      version_b_words: wordsB,
      length_change: lengthChange,
      length_change_pct: Math.round((lengthChange / wordsA) * 100),
      sample_additions: added,
      sample_removals: removed,
      instruction: "Analyze these additions and removals and explain their legal significance for the client.",
    };
  },

  /**
   * Return a template for the requested contract type.
   */
  search_legal_templates: async ({ contract_type, jurisdiction = "Spain", language = "es" }) => {
    const templates = {
      nda: {
        name: "Non-Disclosure Agreement (NDA)",
        sections: ["Parties", "Definition of Confidential Information", "Obligations", "Exceptions", "Duration", "Governing Law"],
        standard_duration: "3 years",
        key_placeholders: ["[PARTY_A]", "[PARTY_B]", "[EFFECTIVE_DATE]", "[JURISDICTION]", "[NOTICE_PERIOD]"],
      },
      saas: {
        name: "SaaS Subscription Agreement",
        sections: ["Parties", "Services", "License Grant", "Payment", "Data Protection", "SLA", "Liability", "Termination", "Governing Law"],
        standard_duration: "12 months auto-renewable",
        key_placeholders: ["[VENDOR]", "[CLIENT]", "[SUBSCRIPTION_FEE]", "[SLA_UPTIME]", "[DATA_REGION]"],
      },
      services: {
        name: "Professional Services Agreement",
        sections: ["Parties", "Scope of Work", "Deliverables", "Payment", "IP Ownership", "Confidentiality", "Termination"],
        standard_duration: "Project-based",
        key_placeholders: ["[SERVICE_PROVIDER]", "[CLIENT]", "[PROJECT_DESCRIPTION]", "[FEE]", "[PAYMENT_SCHEDULE]"],
      },
      employment: {
        name: "Employment Contract",
        sections: ["Parties", "Role", "Start Date", "Compensation", "Benefits", "Working Hours", "Confidentiality", "Non-compete", "Termination"],
        standard_duration: "Indefinite",
        key_placeholders: ["[EMPLOYER]", "[EMPLOYEE]", "[ROLE]", "[SALARY]", "[START_DATE]", "[NOTICE_PERIOD]"],
      },
    };

    const key = Object.keys(templates).find(k =>
      contract_type.toLowerCase().includes(k)
    ) || "services";

    return {
      template_found: true,
      template: templates[key],
      jurisdiction,
      language,
      note: `Template structure for ${templates[key].name} applicable in ${jurisdiction}. Always have a local attorney review before use.`,
    };
  },
};
