import { describe, expect, it, beforeEach } from 'vitest';
import { EMPTY, addPeriod, addSymptom, averageCycleLength, clear, load, removePeriod, save, summarize } from './cycle';

describe('cycle (local)', () => {
  beforeEach(() => localStorage.clear());

  it('calcule la moyenne et la prochaine estimation', () => {
    let d = EMPTY;
    ['2026-07-01', '2026-07-29', '2026-08-27'].forEach((p) => { d = addPeriod(d, p); });
    expect(averageCycleLength(d)).toBe(29); // 28 et 29 jours → 28,5 arrondi
    const s = summarize(d, '2026-09-01');
    expect(s.lastPeriod).toBe('2026-08-27');
    expect(s.dayOfCycle).toBe(6);
    expect(s.nextEstimate).toBe('2026-09-25');
  });

  it('ne donne aucune estimation avec une seule date', () => {
    const s = summarize(addPeriod(EMPTY, '2026-09-01'), '2026-09-10');
    expect(s.dayOfCycle).toBe(10);
    expect(s.nextEstimate).toBeNull();
  });

  it('ignore les intervalles aberrants', () => {
    let d = EMPTY;
    ['2026-01-01', '2026-01-05', '2026-02-02'].forEach((p) => { d = addPeriod(d, p); });
    expect(averageCycleLength(d)).toBe(28);
  });

  it('enregistre, relit et efface uniquement en local', () => {
    const d = addSymptom(addPeriod(EMPTY, '2026-09-01'), '2026-09-02', 'Douleurs');
    expect(save(d)).toBe(true);
    expect(load().periods).toEqual(['2026-09-01']);
    expect(load().symptoms['2026-09-02']).toEqual(['Douleurs']);
    clear();
    expect(load()).toEqual(EMPTY);
    expect(removePeriod(d, '2026-09-01').periods).toEqual([]);
  });

  it('résiste à un stockage corrompu', () => {
    localStorage.setItem('menstruai.cycle.v1', '{pas du json');
    expect(load()).toEqual(EMPTY);
  });
});
