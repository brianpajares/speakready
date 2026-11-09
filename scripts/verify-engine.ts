import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { levenshtein, score, type ScoreInput } from "@/lib/engine";

type Case = {
  id: string;
  input: Record<string, unknown>;
  expected: Record<string, number | string>;
};

async function main() {
  const cases = JSON.parse(await readFile("tests/casos-de-prueba.json", "utf8")) as Case[];
  let passed = 0;
  for (const testCase of cases) {
    let actual: Record<string, number | string>;
    if (testCase.id === "SR-03 levenshtein") {
      const input = testCase.input as { a: string[]; b: string[] };
      actual = { distance: levenshtein(input.a, input.b) };
    } else {
      actual = score(testCase.input as unknown as ScoreInput);
    }
    try {
      assert.deepEqual(actual, testCase.expected);
      passed += 1;
    } catch {
      console.error(`FAILED ${testCase.id}`);
      console.error("expected:", testCase.expected);
      console.error("received:", actual);
    }
  }
  console.log(`${passed}/${cases.length} reference cases match`);
  if (passed !== cases.length) process.exitCode = 1;
}

void main();
