import Anthropic from "@anthropic-ai/sdk";
import type { Topic, TopicHighlight, TopicCategory } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface RawSearchResult {
  title: string;
  url: string;
  content: string;
  source: string;
  relevance_score: number;
  publication_date?: string;
}

interface ProcessedTopic {
  title: string;
  summary: string;
  content: string;
  category: TopicCategory;
  highlights: Array<{
    text: string;
    reason: string;
  }>;
}

export async function processSearchResults(
  results: RawSearchResult[]
): Promise<Topic[]> {
  const topics: Topic[] = [];

  for (const result of results) {
    try {
      const processed = await summarizeAndExtractHighlights(result);
      
      const highlights: TopicHighlight[] = processed.highlights.map((h, idx) => {
        const startIndex = processed.content.indexOf(h.text);
        return {
          id: `${result.url}-highlight-${idx}`,
          text: h.text,
          startIndex: startIndex >= 0 ? startIndex : 0,
          endIndex: startIndex >= 0 ? startIndex + h.text.length : 0,
        };
      });

      topics.push({
        id: `topic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: processed.title,
        summary: processed.summary,
        content: processed.content,
        source: result.source || new URL(result.url).hostname,
        sourceUrl: result.url,
        timestamp: new Date(result.publication_date || Date.now()),
        category: processed.category,
        highlights,
      });
    } catch (error) {
      console.error("Error processing result:", error);
    }
  }

  return topics;
}

async function summarizeAndExtractHighlights(
  result: RawSearchResult
): Promise<ProcessedTopic> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze this article and provide a JSON response with:
1. A compelling title (max 80 chars)
2. A brief summary (2-3 sentences, max 200 chars)
3. The main content rewritten clearly (max 500 chars)
4. Category (one of: news, tech, science, finance, culture, politics, health, sports, general)
5. 3-5 interesting phrases that users would want to learn more about

Article title: ${result.title}
Article content: ${result.content.slice(0, 3000)}

Respond ONLY with valid JSON in this format:
{
  "title": "...",
  "summary": "...",
  "content": "...",
  "category": "...",
  "highlights": [
    {"text": "exact phrase from content", "reason": "why interesting"}
  ]
}`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = textContent.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  return JSON.parse(jsonStr.trim());
}

export async function expandContent(
  topic: Topic,
  additionalContext: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Expand on this topic with more detail and context.

Original topic: ${topic.title}
Current content: ${topic.content}
Additional source material: ${additionalContext}

Provide a comprehensive expansion (3-4 paragraphs) that:
- Adds depth and nuance
- Includes relevant background
- Explains implications
- Remains engaging and clear

Write directly, no preamble.`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  return textContent && textContent.type === "text" ? textContent.text : "";
}

export async function answerQuestion(
  topic: Topic,
  question: string,
  additionalContext?: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Based on this topic, answer the user's question.

Topic: ${topic.title}
Content: ${topic.content}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

User's question: ${question}

Provide a clear, direct answer. If the answer isn't fully known from the context, say so and provide what you can.`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  return textContent && textContent.type === "text" ? textContent.text : "";
}

export async function expandHighlight(
  topic: Topic,
  highlightText: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `The user wants to know more about this specific part of a topic.

Topic: ${topic.title}
Full content: ${topic.content}
Specific phrase they clicked: "${highlightText}"

Explain this specific aspect in 2-3 concise paragraphs. Be informative and engaging.`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  return textContent && textContent.type === "text" ? textContent.text : "";
}

