import type { BrandColors } from './types';

export type BrandId = 'desk' | 'foundation';

export interface BrandDef {
  id: BrandId;
  name: string;
  /** Two-tone placeholder wordmark shown until a logo is uploaded. */
  wordmark: [string, string];
  /** Palette applied when this brand is selected. Still editable afterwards. */
  colors: BrandColors;
}

export const BRANDS: BrandDef[] = [
  { id: 'desk', name: 'Leaders Desk', wordmark: ['LEADERS ', 'DESK'], colors: { navy: '#084A91', orange: '#F07B00', white: '#FFFFFF' } },
  // Palette is a stand-in until the official Leaders Foundation colours are confirmed.
  { id: 'foundation', name: 'Leaders Foundation', wordmark: ['LEADERS ', 'FOUNDATION'], colors: { navy: '#0B5D46', orange: '#E8A317', white: '#FFFFFF' } },
];

export const getBrand = (id: BrandId) => BRANDS.find((b) => b.id === id) ?? BRANDS[0];
