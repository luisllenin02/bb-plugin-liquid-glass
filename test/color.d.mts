export type Rgb = [number, number, number] | number[];

export function relativeLuminance(rgb: Rgb): number;
export function contrastRatio(foreground: Rgb, background: Rgb): number;
export function over(source: Rgb, alpha: number, backdrop: Rgb): number[];
export function hslToRgb(h: number, s: number, l: number): number[];
export function hex(rgb: Rgb): string;
