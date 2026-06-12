import { describe, expect, test } from "vitest";
import {
  classifyDevice,
  generatedDisplayName,
  type DeviceSignals,
} from "./device_profile";

const baseSignals: DeviceSignals = {
  userAgent: "",
  platform: "",
  uaPlatform: null,
  uaMobile: null,
  brands: [],
  model: null,
  maxTouchPoints: 0,
  hover: false,
  anyFinePointer: false,
  anyCoarsePointer: false,
  viewportWidth: 1280,
  viewportHeight: 800,
};

describe("device profile classification", () => {
  test("classifies iPhone as phone", () => {
    const profile = classifyDevice({
      ...baseSignals,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15",
      maxTouchPoints: 5,
      anyCoarsePointer: true,
    });

    expect(profile).toMatchObject({ kind: "phone", os: "ios", browser: "safari" });
  });

  test("classifies iPadOS desktop mode as tablet", () => {
    const profile = classifyDevice({
      ...baseSignals,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/17.0 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
      anyCoarsePointer: true,
    });

    expect(profile).toMatchObject({ kind: "tablet", os: "ipados" });
  });

  test("splits Android mobile and tablet user agents", () => {
    const phone = classifyDevice({
      ...baseSignals,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Chrome/120.0",
      uaMobile: true,
      maxTouchPoints: 5,
    });
    const tablet = classifyDevice({
      ...baseSignals,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) Chrome/120.0",
      maxTouchPoints: 5,
    });

    expect(phone.kind).toBe("phone");
    expect(tablet.kind).toBe("tablet");
  });

  test("keeps touchscreen Windows laptop desktop-class", () => {
    const profile = classifyDevice({
      ...baseSignals,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
      platform: "Win32",
      maxTouchPoints: 10,
      hover: true,
      anyFinePointer: true,
      anyCoarsePointer: true,
    });

    expect(profile).toMatchObject({ kind: "desktop", os: "windows", input: "touch_mouse" });
  });

  test("classifies TV browser keywords", () => {
    const profile = classifyDevice({
      ...baseSignals,
      userAgent: "Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36",
    });

    expect(profile.kind).toBe("tv");
  });

  test("uses model in generated names and falls back without it", () => {
    const withModel = classifyDevice({
      ...baseSignals,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Chrome/120.0",
      model: "Pixel 8",
      uaMobile: true,
      brands: ["Google Chrome"],
    });
    const withoutModel = classifyDevice({
      ...baseSignals,
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0",
    });

    expect(generatedDisplayName(withModel)).toBe("Pixel 8 Phone");
    expect(generatedDisplayName(withoutModel)).toBe("Firefox on Linux Desktop");
  });
});
