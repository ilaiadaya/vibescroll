import { describe, it, expect, vi } from "vitest";

// Test navigation direction logic
describe("Navigation Logic", () => {
  it("should map swipe directions to correct actions", () => {
    const directionActions = {
      down: "nextTopic",
      up: "previousTopic",
      left: "expand",
      right: "collapse",
    };

    expect(directionActions.down).toBe("nextTopic");
    expect(directionActions.up).toBe("previousTopic");
    expect(directionActions.left).toBe("expand");
    expect(directionActions.right).toBe("collapse");
  });

  it("should correctly calculate next topic index", () => {
    const currentIndex = 2;
    const totalTopics = 10;

    const nextIndex = currentIndex + 1;
    const canGoNext = nextIndex < totalTopics;

    expect(canGoNext).toBe(true);
    expect(nextIndex).toBe(3);
  });

  it("should not go past the last topic", () => {
    const currentIndex = 9;
    const totalTopics = 10;

    const nextIndex = currentIndex + 1;
    const canGoNext = nextIndex < totalTopics;

    expect(canGoNext).toBe(false);
  });

  it("should correctly calculate previous topic index", () => {
    const currentIndex = 5;

    const prevIndex = currentIndex - 1;
    const canGoPrev = currentIndex > 0;

    expect(canGoPrev).toBe(true);
    expect(prevIndex).toBe(4);
  });

  it("should not go before the first topic", () => {
    const currentIndex = 0;

    const canGoPrev = currentIndex > 0;

    expect(canGoPrev).toBe(false);
  });
});

// Test depth transitions
describe("Depth Transitions", () => {
  type ViewDepth = "summary" | "expanded" | "detail";

  const getNextDepth = (current: ViewDepth): ViewDepth => {
    if (current === "summary") return "expanded";
    if (current === "expanded") return "detail";
    return "detail";
  };

  const getPrevDepth = (current: ViewDepth): ViewDepth => {
    if (current === "detail") return "expanded";
    if (current === "expanded") return "summary";
    return "summary";
  };

  it("should expand from summary to expanded", () => {
    expect(getNextDepth("summary")).toBe("expanded");
  });

  it("should expand from expanded to detail", () => {
    expect(getNextDepth("expanded")).toBe("detail");
  });

  it("should stay at detail when already at deepest level", () => {
    expect(getNextDepth("detail")).toBe("detail");
  });

  it("should collapse from detail to expanded", () => {
    expect(getPrevDepth("detail")).toBe("expanded");
  });

  it("should collapse from expanded to summary", () => {
    expect(getPrevDepth("expanded")).toBe("summary");
  });

  it("should stay at summary when already at shallowest level", () => {
    expect(getPrevDepth("summary")).toBe("summary");
  });
});

// Test highlight processing
describe("Highlight Processing", () => {
  interface TopicHighlight {
    id: string;
    text: string;
    startIndex: number;
    endIndex: number;
  }

  it("should find highlight text in content", () => {
    const content = "Scientists discovered a new quantum error correction method.";
    const highlightText = "quantum error correction";
    
    const startIndex = content.indexOf(highlightText);
    const endIndex = startIndex + highlightText.length;

    expect(startIndex).toBe(28);
    expect(endIndex).toBe(52);
  });

  it("should handle highlight not found in content", () => {
    const content = "Scientists discovered a new method.";
    const highlightText = "quantum computing";
    
    const startIndex = content.indexOf(highlightText);

    expect(startIndex).toBe(-1);
  });

  it("should sort highlights by start index", () => {
    const highlights: TopicHighlight[] = [
      { id: "h1", text: "world", startIndex: 7, endIndex: 12 },
      { id: "h2", text: "hello", startIndex: 0, endIndex: 5 },
      { id: "h3", text: "test", startIndex: 14, endIndex: 18 },
    ];

    const sorted = [...highlights].sort((a, b) => a.startIndex - b.startIndex);

    expect(sorted[0].id).toBe("h2");
    expect(sorted[1].id).toBe("h1");
    expect(sorted[2].id).toBe("h3");
  });
});

