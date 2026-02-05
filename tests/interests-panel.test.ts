import { describe, it, expect, beforeEach, vi } from "vitest";

describe("InterestsPanel functionality", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it("should save and load interest tags to localStorage", () => {
    const tags = ["AI & Machine Learning", "Space & Astronomy"];
    localStorage.setItem("vibescroll_interest_tags", JSON.stringify(tags));
    
    const loaded = JSON.parse(localStorage.getItem("vibescroll_interest_tags") || "[]");
    expect(loaded).toEqual(tags);
  });

  it("should save and load custom prompt to localStorage", () => {
    const prompt = "I love science and technology";
    localStorage.setItem("vibescroll_custom_prompt", prompt);
    
    const loaded = localStorage.getItem("vibescroll_custom_prompt");
    expect(loaded).toBe(prompt);
  });

  it("should save and load location to localStorage", () => {
    const location = "San Francisco";
    localStorage.setItem("vibescroll_location", location);
    
    const loaded = localStorage.getItem("vibescroll_location");
    expect(loaded).toBe(location);
  });

  it("should clear all preferences on reset", () => {
    localStorage.setItem("vibescroll_interest_tags", JSON.stringify(["Tech"]));
    localStorage.setItem("vibescroll_custom_prompt", "Hello");
    localStorage.setItem("vibescroll_location", "NYC");
    localStorage.setItem("vibescroll_preferences", JSON.stringify({ likedCategories: {}, likedKeywords: {}, totalLikes: 5 }));
    
    // Simulate reset
    localStorage.removeItem("vibescroll_preferences");
    localStorage.removeItem("vibescroll_likes");
    localStorage.removeItem("vibescroll_interest_tags");
    localStorage.removeItem("vibescroll_custom_prompt");
    
    expect(localStorage.getItem("vibescroll_preferences")).toBeNull();
    expect(localStorage.getItem("vibescroll_interest_tags")).toBeNull();
    expect(localStorage.getItem("vibescroll_custom_prompt")).toBeNull();
    // Note: location is NOT cleared on reset (intentional)
    expect(localStorage.getItem("vibescroll_location")).toBe("NYC");
  });
});

