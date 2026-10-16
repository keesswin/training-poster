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
  // Maroon and tan, approximated by eye from the Leaders Foundation logo. Edit under Style & colours if the official values differ.
  { id: 'foundation', name: 'Leaders Foundation', wordmark: ['LEADERS ', 'FOUNDATION'], colors: { navy: '#832840', orange: '#BC8F6D', white: '#FFFFFF' } },
];

export const getBrand = (id: BrandId) => BRANDS.find((b) => b.id === id) ?? BRANDS[0];
