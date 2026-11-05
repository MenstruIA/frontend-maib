import { describe, expect, it } from 'vitest';
import { parseQuery } from './placeQuery';

describe('parseQuery', () => {
  it('sépare le type d’établissement et le lieu', () => {
    expect(parseQuery('Pharmacie à Vodokpo')).toEqual({ kind: 'pharmacy', place: 'Vodokpo' });
    expect(parseQuery('pharmacie Vodokpo Cotonou')).toEqual({ kind: 'pharmacy', place: 'Vodokpo Cotonou' });
    expect(parseQuery('clinique près de Fidjrossè')).toEqual({ kind: 'clinic', place: 'Fidjrossè' });
    expect(parseQuery('Hôpital à Parakou')).toEqual({ kind: 'hospital', place: 'Parakou' });
    expect(parseQuery('centre de santé dans Abomey-Calavi')).toEqual({ kind: 'centre', place: 'Abomey-Calavi' });
  });

  it('accepte les formes avec accents, majuscules et virgules', () => {
    expect(parseQuery('Pharmacies, Cotonou')).toEqual({ kind: 'pharmacy', place: 'Cotonou' });
    expect(parseQuery('HOPITAUX autour de Porto-Novo')).toEqual({ kind: 'hospital', place: 'Porto-Novo' });
  });

  it('un lieu seul n’impose pas de type', () => {
    expect(parseQuery('Vodokpo')).toEqual({ kind: null, place: 'Vodokpo' });
    expect(parseQuery('  Cotonou  ')).toEqual({ kind: null, place: 'Cotonou' });
  });

  it('un type seul n’impose pas de lieu', () => {
    expect(parseQuery('pharmacie')).toEqual({ kind: 'pharmacy', place: null });
    expect(parseQuery('Cliniques')).toEqual({ kind: 'clinic', place: null });
  });

  it('gère une saisie vide', () => {
    expect(parseQuery('   ')).toEqual({ kind: null, place: null });
  });

  it('ne coupe pas un nom de lieu commençant par un mot de liaison', () => {
    expect(parseQuery('pharmacie à Aplahoué').place).toBe('Aplahoué');
    expect(parseQuery('pharmacie Dassa-Zoumé').place).toBe('Dassa-Zoumé');
    expect(parseQuery('pharmacie Lalo').place).toBe('Lalo');
  });
});
