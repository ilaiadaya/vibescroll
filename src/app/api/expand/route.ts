import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Valyu } from "valyu-js";

// Check if we have API keys
const hasValyuKey = !!process.env.VALYU_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

// Log API key status on startup (without revealing the keys)
console.log("API Keys status:", {
  hasValyuKey,
  hasAnthropicKey,
  valuKeyLength: process.env.VALYU_API_KEY?.length || 0,
  anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
});

// Initialize clients if keys exist
const anthropic = hasAnthropicKey
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const valyu = hasValyuKey
  ? new Valyu(process.env.VALYU_API_KEY!)
  : null;

// Search Valyu for more context using official SDK
async function searchValyu(query: string): Promise<string> {
  if (!valyu) return "";

  try {
    const response = await valyu.search(`${query} detailed analysis background context`, {
      maxNumResults: 5,
      maxPrice: 20,
      similarityThreshold: 0.4,
    });

    const results = response.results || [];

    return results
      .slice(0, 3)
      .map((r: { title: string; content: string }) => 
        `${r.title}: ${r.content?.slice(0, 800)}`
      )
      .join("\n\n");
  } catch (err) {
    console.error("Valyu search error:", err);
    return "";
  }
}

// Generate expanded content with Claude
async function expandWithClaude(
  title: string,
  originalContent: string,
  additionalContext: string
): Promise<string> {
  if (!anthropic) return "";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Expand on this topic with more depth, context, and analysis.

Topic: ${title}
Original content: ${originalContent}
${additionalContext ? `Additional research:\n${additionalContext}` : ""}

Provide a comprehensive expansion (3-4 paragraphs) that:
- Adds depth and nuance to the original
- Includes relevant background and context
- Explains implications and significance
- Remains engaging and accessible

Write directly, no preamble. Use **bold** for key terms.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    return textContent && textContent.type === "text" ? textContent.text : "";
  } catch (error) {
    console.error("Claude expand error:", error);
    return "";
  }
}

// Mock expanded content
const mockExpansions: Record<string, string> = {
  "topic-1": `The achievement at Google Quantum AI represents a fundamental shift in quantum computing viability. **Error correction** has been the primary obstacle preventing quantum computers from performing useful calculations. When qubits interact with their environment, they lose their quantum properties—a process called **decoherence**.

The new **surface code** implementation changes this equation. By arranging physical qubits in a 2D grid where each logical qubit is protected by its neighbors, the team showed that larger grids actually perform better. This "threshold" crossing means we can now envision a clear path to millions of logical qubits.

The implications span **drug discovery**, **materials science**, **cryptography**, and **optimization problems**. Companies like IBM, IonQ, and Quantinuum are racing to replicate and extend these results. Most experts now believe fault-tolerant quantum computers could arrive within 5-10 years.`,

  "topic-2": `The **gut-brain connection** operates through multiple pathways that scientists are only beginning to understand. The **vagus nerve** provides a direct neural highway between intestinal neurons and the brain. Additionally, gut bacteria produce neurotransmitters like **serotonin** and **GABA** that influence mood.

The Flemish study identified two bacterial genera—**Coprococcus** and **Dialister**—that were consistently depleted in depressed individuals. These bacteria produce **butyrate**, a short-chain fatty acid that maintains the intestinal lining and reduces inflammation.

Clinical applications are emerging. Several biotech companies are developing "**psychobiotics**"—probiotics specifically designed to improve mental health. Early trials show promise for anxiety. Diet remains the most accessible intervention, with fiber-rich foods promoting beneficial bacteria.`,

  "topic-3": `Central bank coordination in the current environment reflects unusual global economic conditions. The pandemic-era stimulus created synchronized inflation, but paths back to price stability are diverging.

The **ECB** faces a fragile growth picture, with Germany struggling industrially. Lagarde's comments signal readiness to cut rates if prices continue easing. The **US economy** has proven remarkably resilient, keeping the Fed cautious.

Market implications are significant. Currency traders position for **euro weakness** if rate differentials widen. Bond investors face complex duration risk varying by region. The coordinated messaging suggests central banks are trying to minimize volatility from policy divergence.`,
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const topicId = searchParams.get("topicId");
  // Accept topic data directly via query params (URL encoded)
  const topicTitle = searchParams.get("title");
  const topicContent = searchParams.get("content");

  if (!topicId) {
    return NextResponse.json({ error: "Missing topicId" }, { status: 400 });
  }

  console.log("Expand GET request:", { topicId, hasTitle: !!topicTitle, hasContent: !!topicContent });

  let content: string = "";

  if (hasValyuKey && hasAnthropicKey && topicTitle && topicContent) {
    // Use real APIs with provided topic data
    console.log("Using real APIs for expansion");
    try {
      const additionalContext = await searchValyu(topicTitle);
      content = await expandWithClaude(topicTitle, topicContent, additionalContext);
    } catch (error) {
      console.error("Error in expand:", error);
    }

    // Fallback to mock if API fails
    if (!content) {
      console.log("API call failed, falling back to mock");
      content = mockExpansions[topicId] || "Additional context is being gathered...";
    }
  } else if (!hasValyuKey || !hasAnthropicKey) {
    // Use mock data - no API keys
    console.log("No API keys, using mock data");
    await new Promise((resolve) => setTimeout(resolve, 300));
    content = mockExpansions[topicId] || "Additional context is being gathered for this topic.";
  } else {
    // API keys present but no topic data provided
    console.log("API keys present but no topic data, using mock");
    content = mockExpansions[topicId] || "Additional context is being gathered for this topic.";
  }

  return NextResponse.json({ content });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { topicId, highlightText, topicContent } = body;

  if (!topicId || !highlightText) {
    return NextResponse.json(
      { error: "Missing topicId or highlightText" },
      { status: 400 }
    );
  }

  console.log("Expand POST request:", { topicId, highlightText, hasContent: !!topicContent });

  let content: string = "";

  if (hasAnthropicKey) {
    // Generate detail with Claude - use provided topicContent
    const context = topicContent || "";

    try {
      console.log("Using Claude for highlight explanation");
      const response = await anthropic!.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `Explain this specific aspect: "${highlightText}"

${context ? `Context it appeared in: ${context}` : ""}

Provide a focused explanation in 2-3 paragraphs. Be informative and engaging.`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      content = textContent && textContent.type === "text" ? textContent.text : "";
    } catch (error) {
      console.error("Claude highlight error:", error);
      content = "";
    }
  } else {
    console.log("No Anthropic key for highlight expansion");
  }

  // Fallback
  if (!content) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    content = `This aspect involves ${highlightText}. More detailed information would be generated with API keys connected.`;
  }

  return NextResponse.json({ content });
}
