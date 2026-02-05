import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Check if we have API keys
const hasValyuKey = !!process.env.VALYU_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client if key exists
const anthropic = hasAnthropicKey
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Valyu search function
async function searchValyu(query: string, maxResults: number = 5) {
  if (!hasValyuKey) return null;

  try {
    const response = await fetch("https://api.valyu.ai/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VALYU_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        maxNumResults: maxResults,
        maxPrice: 20,
        relevanceThreshold: 0.4,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.results || [];
  } catch {
    return null;
  }
}

// Determine if we should search or just use Claude
function shouldSearch(concept: string): boolean {
  // Search for:
  // - Specific terms (proper nouns, technical terms)
  // - Current events indicators
  // - Numbers, dates, statistics
  const searchIndicators = [
    /\d{4}/, // Years
    /\d+%/, // Percentages
    /[A-Z][a-z]+\s[A-Z]/, // Proper nouns
    /latest|recent|current|new|today|this week/i,
    /company|organization|person|who|what happened/i,
  ];

  // Don't search for:
  // - Very short concepts (likely common words)
  // - Very generic terms
  if (concept.length < 5) return false;

  return searchIndicators.some((pattern) => pattern.test(concept));
}

// Generate explanation with Claude
async function explainWithClaude(
  concept: string,
  context?: string,
  searchResults?: string
): Promise<string> {
  if (!anthropic) {
    return getFallbackExplanation(concept);
  }

  const systemPrompt = `You are an expert educator who explains concepts clearly and engagingly. 
Your explanations should be:
- Informative but accessible
- Well-structured with clear sections
- Include practical examples when helpful
- About 300-500 words

Format with markdown: use **bold** for key terms, bullet points for lists.`;

  let userPrompt = `Explain the concept: "${concept}"`;

  if (context) {
    userPrompt += `\n\nThis appeared in the context of: ${context.slice(0, 500)}`;
  }

  if (searchResults) {
    userPrompt += `\n\nHere is recent information to incorporate:\n${searchResults}`;
  }

  userPrompt += `\n\nProvide a clear, comprehensive explanation. Start directly with the explanation, no preamble.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        { role: "user", content: userPrompt },
      ],
      system: systemPrompt,
    });

    const textContent = response.content.find((c) => c.type === "text");
    return textContent && textContent.type === "text" ? textContent.text : getFallbackExplanation(concept);
  } catch (error) {
    console.error("Claude API error:", error);
    return getFallbackExplanation(concept);
  }
}

// Fallback explanations for demo mode
function getFallbackExplanation(concept: string): string {
  const mockData: Record<string, string> = {
    "quantum error correction": `**Quantum error correction (QEC)** is a set of techniques to protect quantum information from errors due to decoherence and other quantum noise.

Unlike classical error correction, which can simply copy data for redundancy, quantum error correction must work around the **no-cloning theorem**—you cannot copy an unknown quantum state.

**Key Concepts:**
• **Syndrome measurement**: Detecting errors without collapsing the quantum state
• **Logical vs physical qubits**: A single logical qubit is spread across multiple physical qubits
• **Error thresholds**: Below a certain error rate, adding more qubits improves reliability

**Why it matters:**
Without error correction, quantum computers can only run very short computations. Effective QEC is the key to building fault-tolerant quantum computers.`,

    "butyrate": `**Butyrate** is a short-chain fatty acid produced when beneficial gut bacteria ferment dietary fiber.

**What it does:**
• Primary fuel for colonocytes (colon cells)
• Maintains gut barrier integrity
• Reduces inflammation
• Influences gene expression as an HDAC inhibitor

**How to increase it:**
Eating fiber-rich foods (legumes, whole grains, vegetables) feeds butyrate-producing bacteria. Resistant starch is particularly effective.`,

    "gut-brain axis": `The **gut-brain axis** is the bidirectional communication system between your GI tract and central nervous system.

**Communication channels:**
1. **Vagus nerve** - Direct neural highway
2. **Neurotransmitters** - 95% of serotonin is made in the gut
3. **Immune signaling** - Gut inflammation affects brain function
4. **Microbial metabolites** - Compounds like butyrate influence cognition

**Implications:**
Mental health conditions may have gut-based components, and diet/probiotics could complement traditional treatments.`,
  };

  const conceptLower = concept.toLowerCase();
  for (const [key, value] of Object.entries(mockData)) {
    if (conceptLower.includes(key) || key.includes(conceptLower)) {
      return value;
    }
  }

  return `# ${concept}

This concept is being explored. In the full version with API keys connected:

1. **Valyu Search** finds the latest information and research
2. **Claude** synthesizes a clear, comprehensive explanation
3. **Smart caching** ensures instant responses for common concepts

Add your API keys to \`.env.local\` to enable live exploration.`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { concept, topicContext } = body;

  if (!concept) {
    return NextResponse.json({ error: "Missing concept" }, { status: 400 });
  }

  let content: string;

  // Decide whether to search or just use Claude
  const needsSearch = shouldSearch(concept);

  if (hasValyuKey && hasAnthropicKey && needsSearch) {
    // Full pipeline: Search + Claude synthesis
    const searchResults = await searchValyu(`${concept} explanation overview`);

    let searchContext = "";
    if (searchResults && searchResults.length > 0) {
      searchContext = searchResults
        .slice(0, 3)
        .map((r: { title: string; content: string }) => `${r.title}: ${r.content?.slice(0, 500)}`)
        .join("\n\n");
    }

    content = await explainWithClaude(concept, topicContext, searchContext);
  } else if (hasAnthropicKey) {
    // Just Claude (for common/general concepts)
    content = await explainWithClaude(concept, topicContext);
  } else {
    // Fallback to mock data
    await new Promise((resolve) => setTimeout(resolve, 600));
    content = getFallbackExplanation(concept);
  }

  return NextResponse.json({ content });
}
