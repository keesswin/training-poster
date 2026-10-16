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

export type TemplateId = 'hero-editorial' | 'photo-story' | 'event-highlights';

export interface PosterText {
  headline: string;
  /** Words from the headline that get the orange emphasis colour. */
  emphasis: string;
  institution: string;
  location: string;
  /** Optional audience or date, shown only when filled in. */
  detail: string;
}

export interface PosterDoc {
  template: TemplateId;
  text: PosterText;
  colors: BrandColors;
  /** 0..100 */
  patternVisibility: number;
  leadersDeskLogo: LoadedImage | null;
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
