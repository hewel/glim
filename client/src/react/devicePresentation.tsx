import {
  IconDeviceLaptop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconDeviceTv,
  IconDevicesQuestion,
  type Icon,
} from "@tabler/icons-react";
import type { BrowserFamily, DeviceKind, DeviceOs, Peer } from "./types";

export function DeviceKindIcon({
  kind,
  size = 16,
}: {
  kind: DeviceKind;
  size?: number;
}) {
  const Icon = deviceIcon(kind);
  return <Icon aria-hidden="true" size={size} />;
}

export function deviceKindLabel(kind: DeviceKind): string {
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
      return "Unknown device";
  }
}

export function peerDeviceDetails(peer: Peer): string[] {
  return [
    deviceKindLabel(peer.device_kind),
    osLabel(peer.os),
    browserLabel(peer.browser),
    peer.model,
  ].filter((value): value is string => Boolean(value && value !== "Unknown"));
}

export function peerDeviceTitle(peer: Peer): string {
  const details = peerDeviceDetails(peer);
  return details.length > 0 ? details.join(" · ") : "Device details unavailable";
}

function deviceIcon(kind: DeviceKind): Icon {
  switch (kind) {
    case "phone":
      return IconDeviceMobile;
    case "tablet":
      return IconDeviceTablet;
    case "desktop":
      return IconDeviceLaptop;
    case "tv":
      return IconDeviceTv;
    case "unknown":
      return IconDevicesQuestion;
  }
}

function osLabel(os: DeviceOs): string {
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

function browserLabel(browser: BrowserFamily): string {
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
