import type { Identity } from "./types";
import {
  detectDeviceProfile,
  generatedDisplayName,
  unknownDeviceProfile,
  type DeviceProfile,
} from "./device_profile";

const deviceIdKey = "glim.device_id";
const displayNameKey = "glim.display_name";
const defaultDisplayName = "Glim Peer";

export function loadIdentity(): Identity {
  let deviceId = localStorage.getItem(deviceIdKey);
  if (!deviceId) {
    deviceId = randomDeviceId();
    localStorage.setItem(deviceIdKey, deviceId);
  }

  const savedDisplayName = localStorage.getItem(displayNameKey);

  return {
    device_id: deviceId,
    display_name: savedDisplayName || defaultDisplayName,
    display_name_is_default: !savedDisplayName || savedDisplayName === defaultDisplayName,
    device_profile: unknownDeviceProfile(),
  };
}

export function saveDisplayName(displayName: string): void {
  localStorage.setItem(displayNameKey, displayName);
}

export async function loadDetectedProfile(): Promise<{
  profile: DeviceProfile;
  generated_display_name: string;
}> {
  const profile = await detectDeviceProfile();
  return {
    profile,
    generated_display_name: generatedDisplayName(profile),
  };
}

function randomDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `device_${Math.random().toString(36).slice(2)}`;
}
