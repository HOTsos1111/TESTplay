// Department colours. Each department has a standard default, editable per
// show in Show Designer. Colour always accompanies an icon and a text label.
import type { Department } from './types.ts';

export const DEPT_DEFAULTS: Record<string, string> = {
  video: '#EF4444',
  audio: '#3B82F6',
  lighting: '#A855F7',
  stage: '#22C55E',
  foh: '#14B8A6',
};

/** Swatches offered in the editor (the defaults first). */
export const DEPT_PALETTE = ['#EF4444', '#3B82F6', '#A855F7', '#22C55E', '#14B8A6', '#F97316', '#EC4899', '#06B6D4', '#84CC16', '#F43F5E', '#8B5CF6', '#94A3B8'];

const EXTRA = ['#F97316', '#EC4899', '#06B6D4', '#84CC16', '#F43F5E', '#8B5CF6'];

export const isHexColor = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

export function defaultDeptColor(d: Pick<Department, 'key' | 'icon' | 'sort'>): string {
  return DEPT_DEFAULTS[d.key] ?? DEPT_DEFAULTS[d.icon] ?? EXTRA[Math.abs(d.sort) % EXTRA.length];
}

export function deptColor(d: Pick<Department, 'key' | 'icon' | 'sort' | 'color'> | undefined | null): string {
  if (!d) return '#94A3B8';
  return d.color && isHexColor(d.color) ? d.color : defaultDeptColor(d);
}
