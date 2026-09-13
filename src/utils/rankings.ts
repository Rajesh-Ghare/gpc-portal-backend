export interface RankableEntry {
  id: string;
  netScore: number;
}

export interface RankedEntry {
  id: string;
  rank: number;
  percentile: number;
}

/**
 * Standard competition ranking ("1224"): tied scores share a rank, and the
 * next distinct score's rank skips ahead by the number tied (e.g. two
 * students tied for 1st, the next gets rank 3, not 2). Percentile is the
 * percentage of entries that scored strictly lower — tied entries share
 * the same percentile. A single-entry list is defined as the 100th
 * percentile (nothing to be better than).
 */
export function computeRankings(entries: RankableEntry[]): RankedEntry[] {
  const total = entries.length;
  const sorted = [...entries].sort((a, b) => b.netScore - a.netScore);
  const output: RankedEntry[] = [];

  let i = 0;
  while (i < total) {
    let j = i;
    while (j < total && sorted[j]!.netScore === sorted[i]!.netScore) {
      j += 1;
    }
    const rank = i + 1;
    const countStrictlyLower = total - j;
    const percentile = total > 1 ? (countStrictlyLower / total) * 100 : 100;
    for (let k = i; k < j; k += 1) {
      output.push({ id: sorted[k]!.id, rank, percentile });
    }
    i = j;
  }

  return output;
}
