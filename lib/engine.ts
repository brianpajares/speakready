export type ScoreInput = {
  expected: string[];
  recognized: string[];
  words: number;
  duration_s: number;
  pause_s: number;
  fillers: number;
};

export type ScoreResult = {
  per: number;
  pronunciation: number;
  wpm: number;
  fluency: number;
  filler_rate_per_100w: number;
  clean_speech: number;
  overall: number;
  level: "C1_estimado" | "B2_estimado" | "B1_estimado" | "A2_estimado";
};

export function levenshtein(a: string[], b: string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

export function fluencyScore(wpm: number): number {
  if (120 <= wpm && wpm <= 160) return 100;
  if (wpm < 120) return Math.max(0, (100 * (wpm - 60)) / 60);
  return Math.max(0, (100 * (220 - wpm)) / 60);
}

function roundLikePython(value: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = value * factor;
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  const rounded = Math.abs(fraction - 0.5) < Number.EPSILON * Math.max(1, Math.abs(scaled))
    ? (lower % 2 === 0 ? lower : lower + 1)
    : Math.round(scaled);
  return rounded / factor;
}

export function score(input: ScoreInput): ScoreResult {
  const { expected, recognized, words, duration_s, pause_s, fillers } = input;
  const per = expected.length ? levenshtein(expected, recognized) / expected.length : 0;
  const pronunciation = 100 * (1 - Math.min(per, 1));
  const speechTime = Math.max(duration_s - pause_s, 0.001);
  const wpm = words / (speechTime / 60);
  const pauseRatio = duration_s ? pause_s / duration_s : 0;
  const fluency = fluencyScore(wpm) * (1 - Math.max(0, pauseRatio - 0.2));
  const fillerRate = words ? (100 * fillers) / words : 0;
  const cleanSpeech = Math.max(0, 100 - 10 * fillerRate);
  const overall = roundLikePython(0.5 * pronunciation + 0.3 * fluency + 0.2 * cleanSpeech, 1);
  const level = overall >= 85 ? "C1_estimado" : overall >= 70 ? "B2_estimado" : overall >= 55 ? "B1_estimado" : "A2_estimado";
  return {
    per: roundLikePython(per, 4),
    pronunciation: roundLikePython(pronunciation, 1),
    wpm: roundLikePython(wpm, 1),
    fluency: roundLikePython(fluency, 1),
    filler_rate_per_100w: roundLikePython(fillerRate, 2),
    clean_speech: roundLikePython(cleanSpeech, 1),
    overall,
    level,
  };
}

const fillerPatterns = [
  /\byou know\b/gi,
  /\bi mean\b/gi,
  /\bkind of\b/gi,
  /\bsort of\b/gi,
  /\bum\b/gi,
  /\buh\b/gi,
  /\berm\b/gi,
  /\blike\b/gi,
  /\beh\b/gi,
  /\beste\b/gi,
  /\bo sea\b/gi,
];

export function countFillers(transcript: string): number {
  return fillerPatterns.reduce((total, pattern) => total + [...transcript.matchAll(pattern)].length, 0);
}

export function analyzeTranscript(transcript: string, activeSeconds: number) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const duration = Math.max(1, activeSeconds);
  const wpm = Math.round((wordCount / (duration / 60)) * 10) / 10;
  const fillers = countFillers(transcript);
  const fluency = Math.round(fluencyScore(wpm));
  const cleanSpeech = Math.max(0, Math.round(100 - (100 * fillers * 10) / Math.max(1, wordCount)));
  return { wordCount, wpm, fillers, fluency, cleanSpeech, duration };
}
