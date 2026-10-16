export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything the renderer needs to draw an image: a decoded source plus its natural size. */
export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Object URL of the untouched original file, used for editor thumbnails only. */
  url: string;
  name: string;
  /** The untouched uploaded file, kept for sharing the originals. */
  file: File;
}

export interface Photo {
  id: string;
  image: LoadedImage;
  /** 1 = fill the frame exactly, >1 = zoom in. */
  zoom: number;
  /** Focal position inside the overflow, 0..1 (0.5 = centred). */
  fx: number;
  fy: number;
}

export interface BrandColors {
  navy: string;
  orange: string;
  white: string;
}

import type { BrandId } from './brands';

export type TemplateId = 'hero-editorial' | 'photo-story' | 'event-highlights';

export interface PosterText {
  headline: string;
  institution: string;
  location: string;
  /** Optional audience, e.g. "Grade 10". */
  audience: string;
  /** yyyy-mm-dd, defaults to today. */
  date: string;
  showDate: boolean;
  /** Number of students; shown on the poster only when filled in. */
  students: string;
  /** Program description for the shared message. May contain {placeholders}. */
  description: string;
}

export interface PosterDoc {
  template: TemplateId;
  text: PosterText;
  colors: BrandColors;
  /** 0..100 */
  patternVisibility: number;
  brand: BrandId;
  /** One uploaded logo per brand; the selected brand's logo is drawn top-left. */
  brandLogos: Record<BrandId, LoadedImage | null>;
  institutionLogo: LoadedImage | null;
  /** Photos in user order. The hero is picked separately, supports keep list order. */
  photos: Photo[];
  heroId: string | null;
}

export const BRAND = {
  navy: '#084A91',
  orange: '#F07B00',
  white: '#FFFFFF',
} as const;

/** All layouts are authored in this design space and scaled uniformly on render/export. */
export const DESIGN_W = 1080;
export const DESIGN_H = 1350;
