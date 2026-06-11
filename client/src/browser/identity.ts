import type { Identity } from "./types";

const deviceIdKey = "glim.device_id";
const displayNameKey = "glim.display_name";
const defaultDisplayName = "Glim Peer";

export function loadIdentity(): Identity {
  let deviceId = localStorage.getItem(deviceIdKey);
  if (!deviceId) {
    deviceId = randomDeviceId();
    localStorage.setItem(deviceIdKey, deviceId);
  }

  return {
    device_id: deviceId,
    display_name: localStorage.getItem(displayNameKey) || defaultDisplayName,
  };
}

export function saveDisplayName(displayName: string): void {
  localStorage.setItem(displayNameKey, displayName);
}

function randomDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `device_${Math.random().toString(36).slice(2)}`;
}
