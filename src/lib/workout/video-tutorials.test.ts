import { describe, expect, it } from "vitest";
import { extractYouTubeId, resolveExerciseTutorial, exerciseNameToSlug, exerciseNameToBaseSlug } from "./video-tutorials";

describe("extractYouTubeId", () => {
  it("extracts from standard watch URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=vcBig73ojpE")).toBe("vcBig73ojpE");
    expect(extractYouTubeId("https://youtube.com/watch?v=vcBig73ojpE&t=10s")).toBe("vcBig73ojpE");
  });

  it("extracts from short youtu.be URL", () => {
    expect(extractYouTubeId("https://youtu.be/IODxDxX7oi4")).toBe("IODxDxX7oi4");
  });

  it("extracts from embed URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/rT7DgCr-3pg")).toBe("rT7DgCr-3pg");
    expect(extractYouTubeId("https://www.youtube-nocookie.com/embed/rT7DgCr-3pg")).toBe("rT7DgCr-3pg");
  });

  it("extracts from shorts URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/shorts/bEv6CCg2BC8")).toBe("bEv6CCg2BC8");
  });

  it("returns null for invalid or non-youtube URLs", () => {
    expect(extractYouTubeId("https://example.com/video.mp4")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
  });
});

describe("exerciseNameToSlug", () => {
  it("normalizes names correctly", () => {
    expect(exerciseNameToSlug("Bench Press")).toBe("bench-press");
    expect(exerciseNameToBaseSlug("Skull Crusher (EZ Bar)")).toBe("skull-crusher");
    expect(exerciseNameToSlug("Trap Bar / Hex Bar Deadlift")).toBe("trap-bar-hex-bar-deadlift");
  });
});

describe("resolveExerciseTutorial", () => {
  it("resolves curated exercises with YouTube video IDs and technique cues", () => {
    const bench = resolveExerciseTutorial("Bench Press");
    expect(bench.videoType).toBe("youtube");
    expect(bench.embedUrl).toContain("youtube.com/embed/rT7DgCr-3pg");
    expect(bench.formCues.setup.length).toBeGreaterThan(0);
    expect(bench.formCues.execution.length).toBeGreaterThan(0);
    expect(bench.formCues.mistakes.length).toBeGreaterThan(0);
  });

  it("prioritizes explicit database videoUrl if provided", () => {
    const custom = resolveExerciseTutorial("Custom Movement", "https://youtu.be/custom12345");
    expect(custom.videoType).toBe("youtube");
    expect(custom.embedUrl).toContain("custom12345");
  });

  it("falls back to safe watch search URL for completely unknown movements", () => {
    const unknown = resolveExerciseTutorial("Very Rare Circus Exercise XYZ");
    expect(unknown.videoType).toBe("search");
    expect(unknown.watchUrl).toContain("youtube.com/results?search_query=");
    expect(unknown.embedUrl).toContain("youtube.com/embed/");
  });
});

