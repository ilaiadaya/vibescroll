import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Valyu } from "valyu-js";
import type { Topic, TopicCategory } from "@/types";

// Check if we have API keys
const hasValyuKey = !!process.env.VALYU_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

// Log API key status (without revealing the keys)
console.log("Topics API - Keys status:", {
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

interface ValyuResult {
  title: string;
  url: string;
  content: string;
  source: string;
  relevance_score: number;
  publication_date?: string;
}

// Fetch trending topics from Valyu using official SDK
async function fetchFromValyu(): Promise<ValyuResult[]> {
  if (!valyu) return [];

  const queries = [
    "breaking news today most important developments",
    "technology innovation breakthroughs latest",
    "science discoveries research findings recent",
    "financial markets economy news updates",
    "interesting trending topics viral today",
  ];

  const allResults: ValyuResult[] = [];

  try {
    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const response = await valyu.search(query, {
            maxNumResults: 3,
            maxPrice: 20,
            relevanceThreshold: 0.4,
          });
          console.log(`Valyu query "${query.slice(0, 30)}..." returned ${response.results?.length || 0} results`);
          return response.results || [];
        } catch (err) {
          console.error(`Valyu query error for "${query}":`, err);
          return [];
        }
      })
    );

    results.forEach((categoryResults) => {
      allResults.push(...categoryResults);
    });
  } catch (error) {
    console.error("Valyu fetch error:", error);
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return allResults.filter((result) => {
    if (!result.url) return false;
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}

// Process raw results with Claude
async function processWithClaude(results: ValyuResult[]): Promise<Topic[]> {
  if (!anthropic || results.length === 0) return [];

  const topics: Topic[] = [];

  for (const result of results.slice(0, 10)) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Analyze this article and provide a JSON response:

Title: ${result.title}
Content: ${result.content?.slice(0, 3000)}

Return ONLY valid JSON:
{
  "title": "compelling title, max 80 chars",
  "summary": "2-3 sentence summary, max 200 chars",
  "content": "main content rewritten clearly, max 600 chars",
  "category": "one of: news, tech, science, finance, culture, politics, health, sports, general",
  "highlights": [
    {"text": "exact interesting phrase from content that users would want to explore", "reason": "why interesting"}
  ]
}

Include 3-5 highlights - phrases that invite deeper exploration.`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") continue;

      let jsonStr = textContent.text;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];

      const parsed = JSON.parse(jsonStr.trim());

      const highlights = (parsed.highlights || []).map(
        (h: { text: string }, idx: number) => ({
          id: `${result.url}-h-${idx}`,
          text: h.text,
          startIndex: 0,
          endIndex: 0,
        })
      );

      topics.push({
        id: `topic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: parsed.title,
        summary: parsed.summary,
        content: parsed.content,
        source: result.source || new URL(result.url).hostname,
        sourceUrl: result.url,
        timestamp: new Date(result.publication_date || Date.now()),
        category: parsed.category as TopicCategory,
        highlights,
      });
    } catch (error) {
      console.error("Error processing result:", error);
    }
  }

  return topics;
}

// Fun/random topics to mix in for variety
function getRandomTopics(): Topic[] {
  const funTopics: Topic[] = [
    {
      id: `fun-${Date.now()}-1`,
      title: "Why Do Cats Always Land on Their Feet? The Physics Is Wild",
      summary: "The 'righting reflex' involves some genuinely impressive mid-air acrobatics that physicists have studied for decades.",
      content: "Cats have a remarkable ability called the aerial righting reflex that allows them to twist their bodies mid-fall to land on their feet. The physics involves angular momentum conservation - cats bend at the waist, rotating front and back halves independently. They also use their tail as a counterbalance. This reflex develops at 3-4 weeks old and is nearly perfected by 7 weeks. Interestingly, cats falling from higher distances (above 7 stories) often have fewer injuries than those falling from lower heights, because they have time to reach terminal velocity and relax their muscles.",
      source: "Physics Today",
      sourceUrl: "https://example.com",
      timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24),
      category: "science",
      highlights: [
        { id: "fun1-1", text: "aerial righting reflex", startIndex: 0, endIndex: 0 },
        { id: "fun1-2", text: "angular momentum conservation", startIndex: 0, endIndex: 0 },
        { id: "fun1-3", text: "terminal velocity", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: `fun-${Date.now()}-2`,
      title: "The Internet's Obsession With 'Liminal Spaces' Explained",
      summary: "Empty malls, abandoned pools, and eerily familiar hallways - why do these images feel so unsettling yet captivating?",
      content: "Liminal spaces are transitional or threshold locations that feel oddly familiar yet deeply unsettling. The term 'liminal' comes from the Latin 'limen' meaning threshold. These spaces - like empty parking lots at night, hotel corridors, or closed shopping malls - trigger a cognitive dissonance because we recognize them but they're missing the human activity that normally defines them. Psychologists suggest they tap into childhood memories and dreams. The aesthetic has exploded online, spawning communities dedicated to finding and sharing these uncanny images.",
      source: "Internet Culture",
      sourceUrl: "https://example.com",
      timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24),
      category: "culture",
      highlights: [
        { id: "fun2-1", text: "liminal spaces", startIndex: 0, endIndex: 0 },
        { id: "fun2-2", text: "cognitive dissonance", startIndex: 0, endIndex: 0 },
        { id: "fun2-3", text: "uncanny images", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: `fun-${Date.now()}-3`,
      title: "Honey Never Spoils: The 3000-Year-Old Snack That's Still Edible",
      summary: "Archaeologists found honey in Egyptian tombs that was still perfectly preserved. Here's why.",
      content: "Honey is essentially immortal. Its low moisture content (around 17%) creates an environment where bacteria simply cannot survive. The bees also add an enzyme called glucose oxidase which produces hydrogen peroxide, making honey mildly antiseptic. When archaeologists opened 3000-year-old Egyptian tombs, they found pots of honey that were still edible - a bit crystallized, but perfectly safe. This property made honey valuable as a wound treatment throughout history. Even modern medicine is rediscovering its antibacterial properties for treating burns and ulcers.",
      source: "Food Science",
      sourceUrl: "https://example.com",
      timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24),
      category: "science",
      highlights: [
        { id: "fun3-1", text: "glucose oxidase", startIndex: 0, endIndex: 0 },
        { id: "fun3-2", text: "hydrogen peroxide", startIndex: 0, endIndex: 0 },
        { id: "fun3-3", text: "antibacterial properties", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: `fun-${Date.now()}-4`,
      title: "The Most Successful Pirate in History Was a Woman",
      summary: "Ching Shih commanded 1,800 ships and 80,000 pirates - and retired comfortably.",
      content: "Ching Shih terrorized the South China Sea in the early 1800s with a fleet larger than most navies. She started as a prostitute, married a pirate captain, and took over after his death. Her code was strict: disobedience meant beheading, deserters lost their ears, and all loot had to be registered. The Chinese navy, Portuguese navy, AND British navy all failed to defeat her. She eventually negotiated a pardon, kept her wealth, and opened a gambling house. She died peacefully in her bed at 69 - an almost unheard-of ending for a pirate.",
      source: "History",
      sourceUrl: "https://example.com",
      timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24),
      category: "general",
      highlights: [
        { id: "fun4-1", text: "Ching Shih", startIndex: 0, endIndex: 0 },
        { id: "fun4-2", text: "1,800 ships and 80,000 pirates", startIndex: 0, endIndex: 0 },
        { id: "fun4-3", text: "negotiated a pardon", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: `fun-${Date.now()}-5`,
      title: "Why Your Brain Hates That One Song (But Can't Stop Playing It)",
      summary: "Earworms affect 98% of people. Scientists finally understand why some songs get stuck.",
      content: "Involuntary musical imagery - aka earworms - happen when your brain's auditory cortex gets stuck in a loop. Research shows songs with simple, repetitive melodies and unexpected intervals are most likely to stick. Your brain treats an unfinished melody like an incomplete task, triggering the Zeigarnik effect - the tendency to remember unfinished things. The cure? Engage in something cognitively demanding, or listen to the full song to 'close the loop.' Interestingly, musicians get more earworms than non-musicians, and people with obsessive tendencies are more susceptible.",
      source: "Psychology Today",
      sourceUrl: "https://example.com",
      timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24),
      category: "science",
      highlights: [
        { id: "fun5-1", text: "Involuntary musical imagery", startIndex: 0, endIndex: 0 },
        { id: "fun5-2", text: "Zeigarnik effect", startIndex: 0, endIndex: 0 },
        { id: "fun5-3", text: "auditory cortex", startIndex: 0, endIndex: 0 },
      ],
    },
  ];

  // Shuffle and return a subset
  return funTopics.sort(() => Math.random() - 0.5);
}

// Mock data for when APIs aren't available
function getMockTopics(): Topic[] {
  const seriousTopics: Topic[] = [
    {
      id: "topic-1",
      title: "Quantum Computing Achieves New Milestone in Error Correction",
      summary:
        "Researchers have demonstrated a quantum error correction system that could make practical quantum computers a reality within the decade.",
      content:
        "A team at Google Quantum AI has achieved a significant breakthrough in quantum error correction, demonstrating a system that reduces errors faster than it creates them. This milestone, known as 'below threshold' operation, has been a holy grail in quantum computing research. The breakthrough uses a technique called surface codes applied to a grid of 72 qubits, showing that adding more qubits actually improves reliability rather than introducing more noise.",
      source: "Nature",
      sourceUrl: "https://nature.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      category: "tech",
      highlights: [
        { id: "h1-1", text: "quantum error correction", startIndex: 0, endIndex: 0 },
        { id: "h1-2", text: "surface codes applied to a grid of 72 qubits", startIndex: 0, endIndex: 0 },
        { id: "h1-3", text: "below threshold", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: "topic-2",
      title: "New Study Links Gut Microbiome to Mental Health Outcomes",
      summary:
        "A comprehensive analysis reveals specific gut bacteria that correlate with depression and anxiety symptoms.",
      content:
        "Scientists from the Flemish Gut Flora Project have identified specific bacterial species that are consistently depleted in people with depression, regardless of antidepressant treatment. The study analyzed over 1,000 participants and found that bacteria producing butyrate, a compound that strengthens the gut barrier, were particularly important. This gut-brain axis research suggests that targeted probiotics or dietary interventions could complement traditional mental health treatments.",
      source: "Science Daily",
      sourceUrl: "https://sciencedaily.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      category: "health",
      highlights: [
        { id: "h2-1", text: "gut bacteria that correlate with depression", startIndex: 0, endIndex: 0 },
        { id: "h2-2", text: "butyrate", startIndex: 0, endIndex: 0 },
        { id: "h2-3", text: "gut-brain axis", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: "topic-3",
      title: "Central Banks Signal Coordinated Shift in Monetary Policy",
      summary:
        "Federal Reserve and ECB hint at synchronized rate adjustments as inflation concerns evolve.",
      content:
        "In an unusual display of coordination, both the Federal Reserve and European Central Bank have signaled potential policy shifts. Fed Chair Jerome Powell emphasized a 'data-dependent approach' while ECB President Christine Lagarde pointed to 'encouraging disinflation trends.' Market analysts interpret this as preparation for divergent rate paths—with the ECB potentially cutting sooner while the Fed maintains its cautious stance.",
      source: "Bloomberg",
      sourceUrl: "https://bloomberg.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      category: "finance",
      highlights: [
        { id: "h3-1", text: "data-dependent approach", startIndex: 0, endIndex: 0 },
        { id: "h3-2", text: "disinflation trends", startIndex: 0, endIndex: 0 },
        { id: "h3-3", text: "divergent rate paths", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: "topic-4",
      title: "AI-Designed Proteins Could Revolutionize Medicine",
      summary:
        "DeepMind's AlphaFold successor creates novel proteins for targeted drug delivery.",
      content:
        "Building on AlphaFold, DeepMind has unveiled AlphaProteo, a system capable of designing entirely new proteins that don't exist in nature. The tool has already created proteins that can bind to specific disease targets with unprecedented precision. Early applications include proteins that can deliver drugs directly to cancer cells while avoiding healthy tissue, and enzymes that break down environmental pollutants.",
      source: "MIT Technology Review",
      sourceUrl: "https://technologyreview.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
      category: "science",
      highlights: [
        { id: "h4-1", text: "AlphaProteo", startIndex: 0, endIndex: 0 },
        { id: "h4-2", text: "proteins that don't exist in nature", startIndex: 0, endIndex: 0 },
        { id: "h4-3", text: "deliver drugs directly to cancer cells", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: "topic-5",
      title: "The Rise of 'Third Places' in Remote Work Era",
      summary:
        "As hybrid work persists, people flock to libraries, cafes, and co-working spaces for social connection.",
      content:
        "Sociologist Ray Oldenburg's concept of 'third places'—social environments separate from home and work—is experiencing a renaissance. Libraries report 40% increases in weekday visitors, while a new wave of 'work cafes' designed for laptop workers is spreading across major cities. The trend reflects a fundamental shift in how people balance productivity and community.",
      source: "The Atlantic",
      sourceUrl: "https://theatlantic.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
      category: "culture",
      highlights: [
        { id: "h5-1", text: "third places", startIndex: 0, endIndex: 0 },
        { id: "h5-2", text: "40% increases in weekday visitors", startIndex: 0, endIndex: 0 },
        { id: "h5-3", text: "balance productivity and community", startIndex: 0, endIndex: 0 },
      ],
    },
  ];

  // Mix serious topics with fun random ones
  const funTopics = getRandomTopics();
  const mixed = [...seriousTopics];
  
  // Insert 2-3 fun topics randomly throughout
  const funToAdd = funTopics.slice(0, 2 + Math.floor(Math.random() * 2));
  funToAdd.forEach((topic, i) => {
    const insertAt = Math.min(3 + i * 2, mixed.length);
    mixed.splice(insertAt, 0, topic);
  });

  return mixed;
}

export async function GET() {
  let topics: Topic[];
  let mode: "live" | "demo" = "demo";

  if (hasValyuKey && hasAnthropicKey) {
    // Use real APIs
    console.log("Attempting to fetch from Valyu...");
    const results = await fetchFromValyu();
    console.log(`Valyu returned ${results.length} results`);
    
    if (results.length > 0) {
      console.log("Processing with Claude...");
      topics = await processWithClaude(results);
      console.log(`Claude processed ${topics.length} topics`);
    } else {
      topics = [];
    }

    // Mix in some fun topics for variety (after position 4)
    if (topics.length > 4) {
      const funTopics = getRandomTopics().slice(0, 2);
      funTopics.forEach((topic, i) => {
        topics.splice(5 + i * 2, 0, topic);
      });
    }

    // Fallback to mock if API returns empty
    if (topics.length === 0) {
      console.log("No topics from APIs, falling back to mock");
      topics = getMockTopics();
    } else {
      mode = "live";
    }
  } else {
    // Use mock data
    console.log("No API keys detected, using mock data");
    await new Promise((resolve) => setTimeout(resolve, 500));
    topics = getMockTopics();
  }

  return NextResponse.json({ topics, mode });
}
