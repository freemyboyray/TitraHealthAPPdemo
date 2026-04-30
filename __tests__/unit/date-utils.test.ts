import { localDateStr } from '@/lib/date-utils';

describe('localDateStr', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2025, 2, 15); // March 15, 2025 (month is 0-indexed)
    expect(localDateStr(date)).toBe('2025-03-15');
  });

  it('pads single-digit month and day', () => {
    const date = new Date(2025, 0, 5); // January 5, 2025
    expect(localDateStr(date)).toBe('2025-01-05');
  });

  it('handles December 31st', () => {
    const date = new Date(2025, 11, 31);
    expect(localDateStr(date)).toBe('2025-12-31');
  });

  it('defaults to current date when called with no args', () => {
    const result = localDateStr();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });

  it('returns local date, not UTC', () => {
    // A date near midnight UTC — local date should match local interpretation
    const date = new Date(2025, 5, 15, 23, 59, 59); // June 15 at 11:59 PM local
    expect(localDateStr(date)).toBe('2025-06-15');
  });
});
