import { describe, expect, it } from 'vitest';
import { MILESTONES, groupContaining, isGroupHallmark } from './milestones';

describe('milestone groups', () => {
  it('every group id refers to a real milestone', () => {
    const ids = new Set(MILESTONES.map((m) => m.id));
    const grouped = MILESTONES.map((m) => m.id).filter((id) => groupContaining(id));
    expect(grouped.length).toBeGreaterThan(0);
    for (const id of grouped) expect(ids.has(id)).toBe(true);
  });

  it('returns null for a milestone that belongs to no group', () => {
    expect(groupContaining('welcome')).toBeNull();
    expect(isGroupHallmark('welcome')).toBe(false);
  });

  it('only the last id in a group is its hallmark', () => {
    const group = groupContaining('select-source-tool');
    expect(group).not.toBeNull();

    for (const id of group!.slice(0, -1)) {
      expect(isGroupHallmark(id)).toBe(false);
    }
    expect(isGroupHallmark(group![group!.length - 1])).toBe(true);
  });
});
