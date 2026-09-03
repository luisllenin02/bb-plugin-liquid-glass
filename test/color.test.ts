import { describe, expect, it } from "vitest";

import {
  appearancePatchFromHex,
  generateHueRamps,
  hexToHsl,
  hslToHex,
  normalizeHex,
  oklchToHex,
} from "../src/lib/color.js";

function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

describe("colour conversions", () => {
  it.each(["#000000", "#ffffff", "#4298f7", "#f92672", "#66d9ef", "#7f8041"])(
    "round-trips %s through HSL within one channel value",
    (hex) => {
      const roundTrip = hslToHex(hexToHsl(hex));
      channels(hex).forEach((channel, index) => {
        expect(Math.abs(channels(roundTrip)[index]! - channel)).toBeLessThanOrEqual(1);
      });
    },
  );

  it("accepts only a six-digit hex", () => {
    expect(normalizeHex(" #A6E22E ")).toBe("#a6e22e");
    expect(normalizeHex("#fff")).toBeNull();
    expect(normalizeHex("blue")).toBeNull();
  });

  it("converts an OKLCH colour to displayable sRGB", () => {
    expect(oklchToHex(0.7, 0.2, 250)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("preserves every picker shade through the appearance patch", () => {
    const monokai = ["#a6e22e", "#e6db74", "#fd971f", "#f92672", "#ae81ff", "#66d9ef"];
    const pickerShades = [
      ...monokai,
      ...generateHueRamps().flatMap((ramp) => ramp.steps.map((step) => step.hex)),
    ];

    for (const hex of pickerShades) {
      const patch = appearancePatchFromHex(hex);
      expect(
        hslToHex({ h: patch.accentHue, s: patch.accentSaturation, l: patch.accentLightness }),
      ).toBe(hex);
    }
  });
});

describe("hue ramps", () => {
  it("generates nine families with seven monotonic OKLCH lightness steps", () => {
    const ramps = generateHueRamps();
    expect(ramps).toHaveLength(9);
    for (const ramp of ramps) {
      expect(ramp.steps).toHaveLength(7);
      for (let index = 1; index < ramp.steps.length; index += 1) {
        expect(ramp.steps[index]!.oklchLightness).toBeGreaterThan(
          ramp.steps[index - 1]!.oklchLightness,
        );
      }
    }
  });

  it("rejects a ramp too short to grade", () => {
    expect(() => generateHueRamps(1)).toThrow("at least two steps");
  });
});
