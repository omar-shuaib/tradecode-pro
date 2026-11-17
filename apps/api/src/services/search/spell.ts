import { db } from "../../db.js";

/**
 * Typo correction for search queries ("baterry" → "battery").
 *
 * Trigram similarity handles this badly: "baterry" shares more trigrams with
 * "terry" than with "battery". Instead, every word that appears in a tariff
 * description is loaded once into an in-memory vocabulary, and query words
 * that are not in it are replaced by the closest vocabulary word by edit
 * distance. A word is only corrected when the answer is unambiguous enough:
 * same first letter, at least 5 characters, within 1 edit (2 for 7+ chars).
 */
let vocab: Map<string, number> | null = null;
let loading: Promise<Map<string, number>> | null = null;

async function loadVocab(): Promise<Map<string, number>> {
  if (vocab) return vocab;
  loading ??= (async () => {
    const rows = await db.$queryRawUnsafe<{ word: string; n: number }[]>(
      `SELECT word, count(*)::int n FROM (
         SELECT unnest(regexp_split_to_array(lower(description_en), '[^a-z]+')) word FROM hs_codes_china
         UNION ALL SELECT unnest(regexp_split_to_array(lower(description_en), '[^a-z]+')) FROM hs_codes_india
         UNION ALL SELECT unnest(regexp_split_to_array(lower(description_en), '[^a-z]+')) FROM hs_codes_uae
       ) w WHERE length(word) >= 3 GROUP BY word`
    );
    vocab = new Map(rows.map((r) => [r.word, Number(r.n)]));
    return vocab;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/** Damerau-Levenshtein distance (adjacent swaps count as one edit), capped at `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

function correctWord(word: string, words: Map<string, number>): string {
  if (word.length < 5 || !/^[a-z]+$/.test(word) || words.has(word)) return word;
  // Plurals and simple inflections of known words are fine as they are.
  if (words.has(word.replace(/(es|s)$/, ""))) return word;
  const max = word.length >= 7 ? 2 : 1;
  let best = word;
  let bestDist = max + 1;
  let bestFreq = 0;
  for (const [candidate, freq] of words) {
    if (candidate[0] !== word[0]) continue;
    const d = editDistance(word, candidate, max);
    if (d < bestDist || (d === bestDist && freq > bestFreq)) {
      best = candidate;
      bestDist = d;
      bestFreq = freq;
    }
  }
  return bestDist <= max ? best : word;
}

/** Correct misspelled words in a query. Returns the query unchanged if the vocabulary cannot be loaded. */
export async function correctSpelling(query: string): Promise<string> {
  if (!/[a-z]{5,}/i.test(query)) return query;
  let words: Map<string, number>;
  try {
    words = await loadVocab();
  } catch {
    return query;
  }
  return query
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase();
      const fixed = correctWord(lower, words);
      return fixed === lower ? w : fixed;
    })
    .join(" ");
}
