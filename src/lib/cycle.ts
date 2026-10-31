/**
 * Suivi du cycle LOCAL : les données restent dans le navigateur de l'appareil (localStorage),
 * ne sont jamais envoyées au serveur et peuvent être effacées à tout moment.
 * Les estimations sont indicatives et ne constituent ni un avis ni un calcul de risque clinique.
 */
export interface CycleData {
  periods: string[];                         // dates de début des règles (ISO yyyy-mm-dd)
  symptoms: Record<string, string[]>;        // date -> libellés
}

export const STORAGE_KEY = 'menstruai.cycle.v1';
export const EMPTY: CycleData = { periods: [], symptoms: {} };

const DAY = 86_400_000;
export const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
export const addDays = (iso: string, n: number) => toISO(new Date(parse(iso).getTime() + n * DAY + 3_600_000));

export function load(): CycleData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<CycleData>;
    return {
      periods: Array.isArray(parsed.periods) ? parsed.periods.filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p)).sort() : [],
      symptoms: parsed.symptoms && typeof parsed.symptoms === 'object' ? parsed.symptoms : {},
    };
  } catch {
    return { ...EMPTY };
  }
}

export function save(data: CycleData): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function clear(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* stockage indisponible */ }
}

export function addPeriod(data: CycleData, iso: string): CycleData {
  if (data.periods.includes(iso)) return data;
  return { ...data, periods: [...data.periods, iso].sort() };
}

export function removePeriod(data: CycleData, iso: string): CycleData {
  return { ...data, periods: data.periods.filter((p) => p !== iso) };
}

export function addSymptom(data: CycleData, iso: string, label: string): CycleData {
  const list = data.symptoms[iso] ?? [];
  if (list.includes(label)) return data;
  return { ...data, symptoms: { ...data.symptoms, [iso]: [...list, label] } };
}

/** Les 6 derniers intervalles plausibles (15–60 jours) entre deux débuts de règles. */
export function recentGaps(data: CycleData): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < data.periods.length; i++) {
    const g = diffDays(data.periods[i - 1], data.periods[i]);
    if (g >= 15 && g <= 60) gaps.push(g);
  }
  return gaps.slice(-6);
}

/** Durée moyenne des cycles (jours) sur les 6 derniers intervalles plausibles (15–60 j), sinon null. */
export function averageCycleLength(data: CycleData): number | null {
  const recent = recentGaps(data);
  if (!recent.length) return null;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}

export type CyclePattern = 'regular' | 'variable' | 'insufficient';

/**
 * Indication grossière de régularité : au moins 2 intervalles, et un écart de 7 jours ou moins entre le plus court
 * et le plus long = « régulier ». Simple repère d'affichage, pas un avis médical.
 */
export function cyclePattern(data: CycleData): CyclePattern {
  const gaps = recentGaps(data);
  if (gaps.length < 2) return 'insufficient';
  return Math.max(...gaps) - Math.min(...gaps) <= 7 ? 'regular' : 'variable';
}

export interface CycleSummary {
  lastPeriod: string | null;
  dayOfCycle: number | null;
  averageLength: number | null;
  nextEstimate: string | null;
  daysUntilNext: number | null;
  intervalsCount: number;
  pattern: CyclePattern;
}

export function summarize(data: CycleData, today: string = toISO(new Date())): CycleSummary {
  const last = [...data.periods].filter((p) => p <= today).pop() ?? null;
  if (!last) return { lastPeriod: null, dayOfCycle: null, averageLength: null, nextEstimate: null, daysUntilNext: null, intervalsCount: 0, pattern: 'insufficient' };
  const avg = averageCycleLength(data);
  const next = avg ? addDays(last, avg) : null;
  return {
    lastPeriod: last,
    dayOfCycle: diffDays(last, today) + 1,
    averageLength: avg,
    nextEstimate: next,
    daysUntilNext: next ? diffDays(today, next) : null,
    intervalsCount: recentGaps(data).length,
    pattern: cyclePattern(data),
  };
}
