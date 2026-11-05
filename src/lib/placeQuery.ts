import type { PlaceKind } from './placesModel';

export interface ParsedQuery { kind: Exclude<PlaceKind, 'other'> | null; place: string | null }

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Mots-clés reconnus (comparés sans accents, du plus long au plus court). */
const KEYWORDS: [RegExp, Exclude<PlaceKind, 'other'>][] = [
  [/\bcentres?\s+(?:de\s+)?(?:sante|medicaux?|medical)\b/, 'centre'],
  [/\bcentres?\s+de\s+sante\b/, 'centre'],
  [/\b(?:dispensaires?|maternites?)\b/, 'centre'],
  [/\bpharmacies?\b|\bpharmacy\b/, 'pharmacy'],
  [/\bcliniques?\b/, 'clinic'],
  [/\b(?:hopitaux|hopital|chu|chd)\b/, 'hospital'],
  [/\bcentres?\b/, 'centre'],
];
const CONNECTORS = /^(?:a|au|aux|en|dans|pres\s+(?:de|du|des)|autour\s+(?:de|du|des)|vers|sur|de|du|des|d'|l'|le|la|les)(?:\s+|(?=[^a-z]))/;

/**
 * « Pharmacie à Vodokpo » → { kind: 'pharmacy', place: 'Vodokpo' } ; « Vodokpo » → { kind: null, place: 'Vodokpo' } ;
 * « clinique » → { kind: 'clinic', place: null }.
 */
export function parseQuery(input: string): ParsedQuery {
  const original = input.trim().replace(/\s+/g, ' ');
  if (!original) return { kind: null, place: null };
  const norm = strip(original);
  // La comparaison se fait sans accents ; si la longueur change (caractères exotiques), on travaille sur le texte sans accents.
  const source = norm.length === original.length ? original : norm;

  let kind: ParsedQuery['kind'] = null;
  let remainder = source;
  for (const [pattern, k] of KEYWORDS) {
    const match = pattern.exec(norm);
    if (match) {
      kind = k;
      remainder = `${source.slice(0, match.index)} ${source.slice(match.index + match[0].length)}`;
      break;
    }
  }

  let place = remainder.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Retire les mots de liaison de tête (« à », « près de », « dans »…), reconnus sans accents.
  for (let i = 0; i < 3; i++) {
    const folded = strip(place);
    const lead = CONNECTORS.exec(folded);
    if (!lead || lead[0].length === 0 || folded.length !== place.length) break;
    place = place.slice(lead[0].length).trim();
  }
  return { kind, place: place.length >= 2 ? place : null };
}
