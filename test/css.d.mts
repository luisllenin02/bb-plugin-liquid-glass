export function declarations(css: string): Map<string, string>;
export function resolve(value: string, decls: Map<string, string>, seen?: Set<string>): string;
export function colorOf(
  decls: Map<string, string>,
  token: string,
): { rgb: number[]; alpha: number };
export function knobDefault(css: string, knob: string): string;
export function tintLayers(css: string, paneToken: string): number;
export function wallpaperTransmission(
  css: string,
  decls: Map<string, string>,
  paneToken: string,
): number;
export function glassBackdrop(
  css: string,
  decls: Map<string, string>,
  mode: string,
  paneToken: string,
): number[];
