import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Check if we have API keys
const hasValyuKey = !!process.env.VALYU_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client if key exists
const anthropic = hasAnthropicKey
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Search for additional context
async function searchForContext(question: string): Promise<string> {
  if (!hasValyuKey) return "";

  try {
    const response = await fetch("https://api.valyu.ai/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VALYU_API_KEY}`,
      },
      body: JSON.stringify({
        query: question,
        maxNumResults: 3,
        maxPrice: 20,
        relevanceThreshold: 0.4,
      }),
    });

    if (!response.ok) return "";

    const data = await response.json();
    const results = data.results || [];

    return results
      .map((r: { title: string; content: string }) => 
        `${r.title}: ${r.content?.slice(0, 500)}`
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { question, topicContext } = body;

  if (!question) {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }

  let answer: string;

  if (hasAnthropicKey) {
    // Search for additional context if needed
    let searchContext = "";
    if (hasValyuKey) {
      searchContext = await searchForContext(question);
    }

    try {
      const response = await anthropic!.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `Answer this question based on the provided context.

Question: ${question}

${topicContext ? `Topic context:\n${topicContext}` : ""}
${searchContext ? `Additional research:\n${searchContext}` : ""}

Provide a clear, direct answer. If information is uncertain, acknowledge it. Be helpful and informative.`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      answer = textContent && textContent.type === "text" ? textContent.text : "";
    } catch (error) {
      console.error("Claude ask error:", error);
      answer = "";
    }
  } else {
    answer = "";
  }

  // Fallback
  if (!answer) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    answer = `Great question! To provide accurate answers to "${question}", please add your API keys to \`.env.local\`:

\`\`\`
ANTHROPIC_API_KEY=your_key
VALYU_API_KEY=your_key
\`\`\`

With these connected, Vibescroll will search for relevant information and generate comprehensive answers grounded in real data.`;
  }

  return NextResponse.json({ answer });
}
