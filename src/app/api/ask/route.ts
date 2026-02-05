import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Valyu } from "valyu-js";

// Check if we have API keys
const hasValyuKey = !!process.env.VALYU_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

// Initialize clients if keys exist
const anthropic = hasAnthropicKey
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const valyu = hasValyuKey
  ? new Valyu(process.env.VALYU_API_KEY!)
  : null;

// Search for additional context using Valyu SDK
async function searchForContext(question: string): Promise<string> {
  if (!valyu) return "";

  try {
    const response = await valyu.search(question, {
      maxNumResults: 3,
      maxPrice: 20,
      relevanceThreshold: 0.4,
    });

    const results = response.results || [];

    return results
      .map((r) => {
        const content = typeof r.content === 'string' ? r.content : JSON.stringify(r.content);
        return `${r.title}: ${content?.slice(0, 500)}`;
      })
      .join("\n\n");
  } catch (err) {
    console.error("Valyu search error:", err);
    return "";
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { question, topicContext, selectedText } = body;

  if (!question) {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }

  let answer: string;

  if (hasAnthropicKey) {
    // Search for additional context if needed
    let searchContext = "";
    const searchQuery = selectedText ? `${selectedText} ${question}` : question;
    if (hasValyuKey) {
      searchContext = await searchForContext(searchQuery);
    }

    try {
      const response = await anthropic!.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `Answer this question based on the provided context.

Question: ${question}
${selectedText ? `\nThe user is asking specifically about this text: "${selectedText}"` : ""}

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
    answer = `Great question! To provide accurate answers to "${question}"${selectedText ? ` about "${selectedText}"` : ""}, please add your API keys to \`.env.local\`:

\`\`\`
ANTHROPIC_API_KEY=your_key
VALYU_API_KEY=your_key
\`\`\`

With these connected, Vibescroll will search for relevant information and generate comprehensive answers grounded in real data.`;
  }

  return NextResponse.json({ answer });
}
