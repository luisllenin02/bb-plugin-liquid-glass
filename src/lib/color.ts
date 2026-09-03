export type Hsl = { h: number; s: number; l: number };

export type RampStep = {
  hex: string;
  oklchLightness: number;
};

export type HueRamp = {
  name: string;
  hue: number;
  steps: RampStep[];
};

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  return HEX_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

function channelToHex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, "0");
}

export function hexToHsl(value: string): Hsl {
  const hex = normalizeHex(value);
  if (hex === null) throw new Error(`Invalid six-digit hex colour: ${value}`);
  const [r, g, b] = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { h: hue, s: saturation * 100, l: lightness * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.min(100, Math.max(0, s)) / 100;
  const lightness = Math.min(100, Math.max(0, l)) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [r, g, b] = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
    : section < 3 ? [0, chroma, x]
    : section < 4 ? [0, x, chroma]
    : section < 5 ? [x, 0, chroma]
    : [chroma, 0, x];
  const offset = lightness - chroma / 2;
  return `#${channelToHex((r + offset) * 255)}${channelToHex(
    (g + offset) * 255,
  )}${channelToHex((b + offset) * 255)}`;
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function oklchChannels(lightness: number, chroma: number, hue: number): number[] {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Converts OKLCH to a displayable sRGB hex, reducing chroma only when needed. */
export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  let resolvedChroma = Math.max(0, chroma);
  let channels = oklchChannels(lightness, resolvedChroma, hue);
  while (channels.some((channel) => channel < 0 || channel > 1) && resolvedChroma > 0.001) {
    resolvedChroma *= 0.94;
    channels = oklchChannels(lightness, resolvedChroma, hue);
  }
  return `#${channels.map((channel) => channelToHex(channel * 255)).join("")}`;
}

const HUE_FAMILIES = [
  { name: "Red", hue: 25 },
  { name: "Orange", hue: 50 },
  { name: "Amber", hue: 85 },
  { name: "Green", hue: 145 },
  { name: "Teal", hue: 185 },
  { name: "Blue", hue: 250 },
  { name: "Indigo", hue: 280 },
  { name: "Violet", hue: 310 },
  { name: "Pink", hue: 350 },
] as const;

export function generateHueRamps(stepCount = 7): HueRamp[] {
  if (!Number.isInteger(stepCount) || stepCount < 2) {
    throw new Error("A hue ramp needs at least two steps");
  }
  return HUE_FAMILIES.map((family) => ({
    ...family,
    steps: Array.from({ length: stepCount }, (_, index) => {
      const oklchLightness = 0.36 + (index / (stepCount - 1)) * 0.46;
      return {
        hex: oklchToHex(oklchLightness, 0.2, family.hue),
        oklchLightness,
      };
    }),
  }));
}

export function appearancePatchFromHex(hex: string): {
  accentHue: number;
  accentSaturation: number;
  accentLightness: number;
} {
  const hsl = hexToHsl(hex);
  return {
    accentHue: hsl.h,
    accentSaturation: hsl.s,
    accentLightness: hsl.l,
  };
}
