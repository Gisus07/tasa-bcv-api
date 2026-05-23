import { describe, it, expect } from 'vitest';
import { median } from './client.js';

describe('median', () => {
  it('odd length → middle element', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('even length → mean of the two middle elements', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('single element', () => {
    expect(median([5])).toBe(5);
  });

  it('does not depend on input order', () => {
    expect(median([721.5, 723, 721.1, 722, 721.6])).toBe(721.6);
  });

  it('throws on empty input', () => {
    expect(() => median([])).toThrow();
  });
});
