import { describe, it, expect } from 'vitest';
import { carryForwardTo } from './rates.service.js';
import type { Rate } from '../db/schema.js';

function makeRate(overrides: Partial<Rate> = {}): Rate {
  return {
    date: '2026-05-20',
    currency: 'USD',
    rate: '500.00000000',
    source: 'BCV',
    sourceFile: '2_1_1_tdc.xlsx',
    publishedAt: null,
    isPropagated: false,
    propagatedFrom: null,
    fetchedAt: new Date('2026-05-20T04:00:00Z'),
    updatedAt: new Date('2026-05-20T04:00:00Z'),
    ...overrides,
  };
}

describe('carryForwardTo', () => {
  it('passes a row through unchanged when it is already today', () => {
    const row = makeRate({ date: '2026-05-24' });
    expect(carryForwardTo(row, '2026-05-24')).toBe(row);
  });

  it('passes through unchanged when the row is newer than today (future published)', () => {
    const row = makeRate({ date: '2026-05-25' });
    expect(carryForwardTo(row, '2026-05-24')).toBe(row);
  });

  it('carries a real past row forward to today, flagged propagated from its own date', () => {
    const row = makeRate({ date: '2026-05-22', isPropagated: false, propagatedFrom: null });
    const out = carryForwardTo(row, '2026-05-24');
    expect(out.date).toBe('2026-05-24');
    expect(out.isPropagated).toBe(true);
    expect(out.propagatedFrom).toBe('2026-05-22');
    expect(out.rate).toBe('500.00000000'); // value preserved
  });

  it('keeps the original origin when carrying an already-propagated row forward', () => {
    const row = makeRate({ date: '2026-05-23', isPropagated: true, propagatedFrom: '2026-05-22' });
    const out = carryForwardTo(row, '2026-05-24');
    expect(out.date).toBe('2026-05-24');
    expect(out.isPropagated).toBe(true);
    expect(out.propagatedFrom).toBe('2026-05-22'); // not 2026-05-23
  });

  it('does not mutate the input row', () => {
    const row = makeRate({ date: '2026-05-22' });
    carryForwardTo(row, '2026-05-24');
    expect(row.date).toBe('2026-05-22');
    expect(row.isPropagated).toBe(false);
  });
});
