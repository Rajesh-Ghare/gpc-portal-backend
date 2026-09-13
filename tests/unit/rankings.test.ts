import { describe, expect, it } from 'vitest';
import { computeRankings } from '../../src/utils/rankings';

describe('computeRankings', () => {
  it('ranks distinct scores in descending order', () => {
    const result = computeRankings([
      { id: 'a', netScore: 10 },
      { id: 'b', netScore: 30 },
      { id: 'c', netScore: 20 },
    ]);
    expect(result.find((r) => r.id === 'b')?.rank).toBe(1);
    expect(result.find((r) => r.id === 'c')?.rank).toBe(2);
    expect(result.find((r) => r.id === 'a')?.rank).toBe(3);
  });

  it('applies standard competition ranking for ties (1224, not 1223)', () => {
    const result = computeRankings([
      { id: 'a', netScore: 50 },
      { id: 'b', netScore: 50 },
      { id: 'c', netScore: 30 },
      { id: 'd', netScore: 10 },
    ]);
    expect(result.find((r) => r.id === 'a')?.rank).toBe(1);
    expect(result.find((r) => r.id === 'b')?.rank).toBe(1);
    expect(result.find((r) => r.id === 'c')?.rank).toBe(3);
    expect(result.find((r) => r.id === 'd')?.rank).toBe(4);
  });

  it('computes percentile as the share of entries scored strictly lower', () => {
    const result = computeRankings([
      { id: 'top', netScore: 100 },
      { id: 'mid', netScore: 50 },
      { id: 'bottom', netScore: 0 },
      { id: 'bottom2', netScore: 0 },
    ]);
    expect(result.find((r) => r.id === 'top')?.percentile).toBe(75);
    expect(result.find((r) => r.id === 'mid')?.percentile).toBe(50);
    expect(result.find((r) => r.id === 'bottom')?.percentile).toBe(0);
    expect(result.find((r) => r.id === 'bottom2')?.percentile).toBe(0);
  });

  it('gives the only entry the 100th percentile', () => {
    const result = computeRankings([{ id: 'solo', netScore: 42 }]);
    expect(result[0]).toEqual({ id: 'solo', rank: 1, percentile: 100 });
  });

  it('returns an empty array for no entries', () => {
    expect(computeRankings([])).toEqual([]);
  });
});
