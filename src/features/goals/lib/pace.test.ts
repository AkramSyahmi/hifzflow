import { describe, expect, it } from 'vitest';

import {
  ayahsPerDayAsPages,
  paceMessage,
  scopeLabel,
  STATE_LABEL,
  type GoalProgress,
} from './pace';

const goal = (overrides: Partial<GoalProgress> = {}): GoalProgress =>
  ({
    id: 'g1',
    user_id: 'u1',
    name: "Juz' 30",
    scope_type: 'juz',
    scope_from: 30,
    scope_to: null,
    ayah_range: '[5673,6237)',
    started_on: '2025-01-01',
    target_date: '2025-06-01',
    status: 'active',
    completed_at: null,
    scope_ayahs: 564,
    scope_pages: 23,
    baseline_ayahs: 0,
    memorised_ayahs: 100,
    remaining_ayahs: 464,
    percent_complete: 17.7,
    days_total: 151,
    days_elapsed: 30,
    days_remaining: 121,
    required_ayahs_per_day: 3.8,
    recent_ayahs_per_day: 4,
    average_ayahs_per_day: 3.3,
    projected_completion_date: '2025-05-01',
    state: 'on_track',
    ...overrides,
  }) as GoalProgress;

describe('ayahsPerDayAsPages', () => {
  it('converts using the scope own ayah density', () => {
    // Juz 30 is unusually dense: 564 ayahs across 23 pages.
    expect(ayahsPerDayAsPages(24.5, 564, 23)).toBe(1);
  });

  it('returns 0 for a scope with no pages', () => {
    expect(ayahsPerDayAsPages(10, 500, 0)).toBe(0);
  });
});

describe('paceMessage', () => {
  it('says nothing for a complete goal', () => {
    expect(paceMessage(goal({ state: 'complete' }))).toBeNull();
  });

  it('explains a stall without projecting a date', () => {
    const message = paceMessage(
      goal({ state: 'stalled', recent_ayahs_per_day: 0 })
    );
    expect(message).toMatch(/no pace to project/i);
  });

  it('quantifies how far behind, as a multiple of current pace', () => {
    const message = paceMessage(
      goal({
        state: 'behind',
        remaining_ayahs: 400,
        days_remaining: 40,
        recent_ayahs_per_day: 2,
      })
    );
    // 400 over 40 days is 10 a day, against a current 2 a day.
    expect(message).toContain('5×');
  });

  it('does not pretend a pace exists when there is none', () => {
    const message = paceMessage(
      goal({ state: 'behind', recent_ayahs_per_day: 0 })
    );
    expect(message).toBe('The current pace does not reach this date.');
  });

  it('states the position plainly when overdue', () => {
    const message = paceMessage(
      goal({ state: 'overdue', remaining_ayahs: 120 })
    );
    expect(message).toContain('120 ayahs left');
    expect(message).toMatch(/new date/i);
  });
});

describe('scopeLabel', () => {
  it('names the whole Quran', () => {
    expect(
      scopeLabel({ scope_type: 'quran', scope_from: null, scope_to: null })
    ).toBe('The whole Quran');
  });

  it('names a single juz and a span', () => {
    expect(
      scopeLabel({ scope_type: 'juz', scope_from: 30, scope_to: null })
    ).toBe("Juz' 30");
    expect(scopeLabel({ scope_type: 'juz', scope_from: 1, scope_to: 5 })).toBe(
      "Juz' 1–5"
    );
  });

  it('distinguishes singular and plural for surahs and pages', () => {
    expect(
      scopeLabel({ scope_type: 'surah', scope_from: 67, scope_to: null })
    ).toBe('Surah 67');
    expect(
      scopeLabel({ scope_type: 'pages', scope_from: 1, scope_to: 20 })
    ).toBe('Pages 1–20');
  });
});

describe('STATE_LABEL', () => {
  it('covers every state the view can report', () => {
    const states: GoalProgress['state'][] = [
      'complete',
      'on_track',
      'behind',
      'stalled',
      'overdue',
      'abandoned',
    ];
    for (const state of states) {
      expect(STATE_LABEL[state]).toBeTruthy();
    }
  });
});
