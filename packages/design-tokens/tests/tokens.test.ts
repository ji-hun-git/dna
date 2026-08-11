import tokens from "../tokens.json" with { type: "json" };
import { describe, expect, it } from "vitest";

const luminance = (hex: string) => {
  const channels = hex.slice(1).match(/.{2}/g)!.map((part) => Number.parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

describe("Midnight Evidence Ledger tokens", () => {
  it("meets body and focus contrast gates", () => {
    expect(contrast(tokens.color.text.primary, tokens.color.surface.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color.focus.ring, tokens.color.surface.canvas)).toBeGreaterThanOrEqual(3);
  });

  it("keeps verification and danger semantically distinct", () => {
    expect(tokens.color.status.verified).not.toBe(tokens.color.status.danger);
    expect(tokens.target.minimum).toBe("44px");
    expect(Number.parseInt(tokens.motion.standard)).toBeLessThanOrEqual(200);
  });

  it("pins the editorial Korean sans and numeric mono families", () => {
    expect(tokens.type.sans).toMatch(/^"IBM Plex Sans KR"/);
    expect(tokens.type.mono).toMatch(/^"IBM Plex Mono"/);
  });
});
