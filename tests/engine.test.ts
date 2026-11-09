import { describe, it } from "node:test";
import assert from "node:assert/strict";
import cases from "./casos-de-prueba.json";
import { analyzeTranscript, countFillers, fluencyScore, levenshtein, score } from "../lib/engine";

type EngineCase = {
  id: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
};

describe("SpeakReady deterministic engine", () => {
  it("matches every supplied reference case", () => {
    for (const testCase of cases as unknown as EngineCase[]) {
      if (testCase.id === "SR-03 levenshtein") {
        const input = testCase.input as { a: string[]; b: string[] };
        assert.deepEqual({ distance: levenshtein(input.a, input.b) }, testCase.expected, testCase.id);
      } else {
        const input = testCase.input as Parameters<typeof score>[0];
        assert.deepEqual(score(input), testCase.expected, testCase.id);
      }
    }
  });

  it("keeps pace scores bounded and neutral in the target range", () => {
    assert.equal(fluencyScore(120), 100);
    assert.equal(fluencyScore(140), 100);
    assert.equal(fluencyScore(160), 100);
    assert.equal(fluencyScore(60), 0);
    assert.equal(fluencyScore(220), 0);
    for (const wpm of [0, 30, 75, 110, 180, 220, 300]) {
      assert.ok(fluencyScore(wpm) >= 0);
      assert.ok(fluencyScore(wpm) <= 100);
    }
  });

  it("counts common English and Spanish fillers without storing a transcript", () => {
    assert.equal(countFillers("Um, I think, you know, este, it is like that."), 4);
    assert.deepEqual(analyzeTranscript("I enjoy learning new skills with my team", 30), {
      wordCount: 8,
      wpm: 16,
      fillers: 0,
      fluency: 0,
      cleanSpeech: 100,
      duration: 30,
    });
  });
});
