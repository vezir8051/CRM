import type { Job } from '@/types';
import { fmtCHF } from '@/domain/format';

/** Lohnspanne bzw. Stundentarif einer Vakanz als Text */
export function lohnText(j: Job): string {
  if (j.art === 'Temporär') return j.tarif ? `${fmtCHF(j.tarif, { decimals: true })}/h` : '–';
  if (j.lohnMin && j.lohnMax) return `${fmtCHF(j.lohnMin)} – ${j.lohnMax.toLocaleString('de-CH')}`;
  return j.lohnMin || j.lohnMax ? fmtCHF(j.lohnMin ?? j.lohnMax) : '–';
}
