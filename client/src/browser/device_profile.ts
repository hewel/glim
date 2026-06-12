export type DeviceKind = "phone" | "tablet" | "desktop" | "tv" | "unknown";
export type DeviceOs =
  | "android"
  | "ios"
  | "ipados"
  | "windows"
  | "macos"
  | "linux"
  | "unknown";
export type BrowserFamily = "chrome" | "firefox" | "safari" | "edge" | "unknown";
export type InputKind = "touch" | "mouse" | "touch_mouse" | "unknown";
export type Confidence = "high" | "medium" | "low";

export interface DeviceProfile {
  kind: DeviceKind;
  os: DeviceOs;
  browser: BrowserFamily;
  input: InputKind;
  model: string | null;
  confidence: Confidence;
  reasons: string[];
}

export interface DeviceSignals {
  userAgent: string;
  platform: string;
  uaPlatform: string | null;
  uaMobile: boolean | null;
  brands: string[];
  model: string | null;
  maxTouchPoints: number;
  hover: boolean;
  anyFinePointer: boolean;
  anyCoarsePointer: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

interface NavigatorUADataLike {
  readonly brands?: ReadonlyArray<{ readonly brand: string; readonly version: string }>;
  readonly mobile?: boolean;
  readonly platform?: string;
  getHighEntropyValues?: (
    hints: ReadonlyArray<"model">,
  ) => Promise<{ readonly model?: string }>;
}

export function unknownDeviceProfile(): DeviceProfile {
  return {
    kind: "unknown",
    os: "unknown",
    browser: "unknown",
    input: "unknown",
    model: null,
    confidence: "low",
    reasons: ["classification pending"],
  };
}

export async function detectDeviceProfile(): Promise<DeviceProfile> {
  const signals = await collectDeviceSignals();
  return classifyDevice(signals);
}

export async function collectDeviceSignals(): Promise<DeviceSignals> {
  const nav = globalThis.navigator;
  const uaData = navigatorUAData(nav);
  const model = await highEntropyModel(uaData);

  return {
    userAgent: nav.userAgent || "",
    platform: nav.platform || "",
    uaPlatform: uaData?.platform ?? null,
    uaMobile: uaData?.mobile ?? null,
    brands: uaData?.brands?.map((brand) => brand.brand) ?? [],
    model,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    hover: matchesMedia("(hover: hover)"),
    anyFinePointer: matchesMedia("(any-pointer: fine)"),
    anyCoarsePointer: matchesMedia("(any-pointer: coarse)"),
    viewportWidth: globalThis.innerWidth || 0,
    viewportHeight: globalThis.innerHeight || 0,
  };
}

export function classifyDevice(signals: DeviceSignals): DeviceProfile {
  const userAgent = signals.userAgent;
  const platform = signals.uaPlatform || signals.platform;
  const source = `${userAgent} ${platform}`;
  const input = classifyInput(signals);
  const os = classifyOs(signals, source);
  const browser = classifyBrowser(signals, userAgent);
  const model = sanitizeModel(signals.model);
  const shortSide = Math.min(signals.viewportWidth, signals.viewportHeight);
  const reasons: string[] = [];

  if (isTv(source)) {
    reasons.push("tv keyword in browser platform hints");
    return profile("tv", os, browser, input, model, "high", reasons);
  }
  if (/iPhone|iPod/i.test(userAgent)) {
    reasons.push("user agent identifies iPhone or iPod");
    return profile("phone", "ios", browser, input, model, "high", reasons);
  }
  if (/iPad/i.test(userAgent) || os === "ipados") {
    reasons.push("browser platform hints identify iPadOS");
    return profile("tablet", "ipados", browser, input, model, "high", reasons);
  }
  if (/Android/i.test(userAgent) || os === "android") {
    if (/Mobile/i.test(userAgent) || signals.uaMobile === true) {
      reasons.push("Android mobile hint is present");
      return profile("phone", "android", browser, input, model, "high", reasons);
    }
    reasons.push("Android without mobile hint");
    return profile("tablet", "android", browser, input, model, "medium", reasons);
  }
  if (os === "windows" || os === "macos" || os === "linux") {
    reasons.push("desktop OS family");
    if (signals.maxTouchPoints > 0 && signals.anyFinePointer && signals.hover) {
      reasons.push("touch plus fine pointer treated as desktop-class input");
    }
    return profile("desktop", os, browser, input, model, "high", reasons);
  }
  if (input === "touch" && shortSide > 0 && shortSide < 600) {
    reasons.push("coarse touch input with phone-sized short side");
    return profile("phone", os, browser, input, model, "medium", reasons);
  }
  if (input === "touch" && shortSide >= 600 && shortSide <= 900) {
    reasons.push("coarse touch input with tablet-sized short side");
    return profile("tablet", os, browser, input, model, "medium", reasons);
  }
  if (signals.anyFinePointer && signals.hover) {
    reasons.push("fine pointer and hover support");
    return profile("desktop", os, browser, input, model, "medium", reasons);
  }

  reasons.push("no decisive device classification signals");
  return profile("unknown", os, browser, input, model, "low", reasons);
}

export function generatedDisplayName(profile: DeviceProfile): string {
  const kind = titleKind(profile.kind);
  if (profile.model) {
    return `${profile.model} ${kind}`;
  }

  const browser = titleBrowser(profile.browser);
  const os = titleOs(profile.os);
  if (browser === "Unknown" && os === "Unknown") {
    return `Unknown ${kind}`;
  }
  if (browser === "Unknown") {
    return `${os} ${kind}`;
  }
  if (os === "Unknown") {
    return `${browser} ${kind}`;
  }
  return `${browser} on ${os} ${kind}`;
}

function profile(
  kind: DeviceKind,
  os: DeviceOs,
  browser: BrowserFamily,
  input: InputKind,
  model: string | null,
  confidence: Confidence,
  reasons: string[],
): DeviceProfile {
  return { kind, os, browser, input, model, confidence, reasons };
}

function classifyInput(signals: DeviceSignals): InputKind {
  const hasTouch = signals.maxTouchPoints > 0 || signals.anyCoarsePointer;
  const hasMouse = signals.anyFinePointer || signals.hover;
  if (hasTouch && hasMouse) {
    return "touch_mouse";
  }
  if (hasTouch) {
    return "touch";
  }
  if (hasMouse) {
    return "mouse";
  }
  return "unknown";
}

function classifyOs(signals: DeviceSignals, source: string): DeviceOs {
  if (/Android/i.test(source)) {
    return "android";
  }
  if (/iPhone|iPod/i.test(source)) {
    return "ios";
  }
  if (/iPad/i.test(source)) {
    return "ipados";
  }
  if (/Macintosh|MacIntel|macOS|Mac OS/i.test(source) && signals.maxTouchPoints > 1) {
    return "ipados";
  }
  if (/Windows|Win32|Win64/i.test(source)) {
    return "windows";
  }
  if (/Macintosh|MacIntel|macOS|Mac OS/i.test(source)) {
    return "macos";
  }
  if (/Linux|X11/i.test(source)) {
    return "linux";
  }
  return "unknown";
}

function classifyBrowser(signals: DeviceSignals, userAgent: string): BrowserFamily {
  const brands = signals.brands.join(" ");
  if (/Microsoft Edge|Edge/i.test(brands) || /Edg\//i.test(userAgent)) {
    return "edge";
  }
  if (/Firefox|FxiOS/i.test(userAgent)) {
    return "firefox";
  }
  if (/Google Chrome|Chromium|Chrome/i.test(brands) || /Chrome|CriOS|Chromium/i.test(userAgent)) {
    return "chrome";
  }
  if (/Safari/i.test(userAgent)) {
    return "safari";
  }
  return "unknown";
}

function sanitizeModel(model: string | null): string | null {
  const sanitized = (model ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!sanitized) {
    return null;
  }
  return sanitized.slice(0, 80);
}

function isTv(source: string): boolean {
  return /SmartTV|Tizen|webOS|TV|AFT|CrKey/i.test(source);
}

function navigatorUAData(nav: Navigator): NavigatorUADataLike | null {
  if (!("userAgentData" in nav)) {
    return null;
  }

  return (nav as Navigator & { readonly userAgentData?: NavigatorUADataLike }).userAgentData ?? null;
}

async function highEntropyModel(uaData: NavigatorUADataLike | null): Promise<string | null> {
  if (!uaData?.getHighEntropyValues) {
    return null;
  }

  try {
    const values = await uaData.getHighEntropyValues(["model"]);
    return values.model ?? null;
  } catch (_error) {
    return null;
  }
}

function matchesMedia(query: string): boolean {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }
  return globalThis.matchMedia(query).matches;
}

function titleKind(kind: DeviceKind): string {
  switch (kind) {
    case "phone":
      return "Phone";
    case "tablet":
      return "Tablet";
    case "desktop":
      return "Desktop";
    case "tv":
      return "TV";
    case "unknown":
      return "Device";
  }
}

function titleOs(os: DeviceOs): string {
  switch (os) {
    case "android":
      return "Android";
    case "ios":
      return "iOS";
    case "ipados":
      return "iPadOS";
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    case "unknown":
      return "Unknown";
  }
}

function titleBrowser(browser: BrowserFamily): string {
  switch (browser) {
    case "chrome":
      return "Chrome";
    case "firefox":
      return "Firefox";
    case "safari":
      return "Safari";
    case "edge":
      return "Edge";
    case "unknown":
      return "Unknown";
  }
}
