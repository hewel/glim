import type { Identity } from "./types";
import { Effect, Schema } from "effect";
import {
  detectDeviceProfile,
  generatedDisplayName,
  unknownDeviceProfile,
  type DeviceProfile,
} from "./device_profile";

const deviceIdKey = "glim.device_id";
const peerSessionIdKey = "glim.peer_session_id";
const displayNameKey = "glim.display_name";
const defaultDisplayName = "Glim Peer";

export class IdentityStorageError extends Schema.TaggedErrorClass<IdentityStorageError>()(
  "IdentityStorageError",
  {
    message: Schema.String,
  },
) {}

export class DeviceProfileDetectionError extends Schema.TaggedErrorClass<DeviceProfileDetectionError>()(
  "DeviceProfileDetectionError",
  {
    message: Schema.String,
  },
) {}

export function loadIdentity(): Identity {
  return Effect.runSync(Effect.match(loadIdentityEffect(), {
    onFailure: () => fallbackIdentity(),
    onSuccess: (identity) => identity,
  }));
}

export function saveDisplayName(displayName: string): void {
  Effect.runSync(Effect.match(saveDisplayNameEffect(displayName), {
    onFailure: () => undefined,
    onSuccess: () => undefined,
  }));
}

export async function loadDetectedProfile(): Promise<{
  profile: DeviceProfile;
  generated_display_name: string;
}> {
  return Effect.runPromise(Effect.match(loadDetectedProfileEffect(), {
    onFailure: () => {
      const profile = unknownDeviceProfile();
      return {
        profile,
        generated_display_name: generatedDisplayName(profile),
      };
    },
    onSuccess: (profile) => profile,
  }));
}

export const loadIdentityEffect = Effect.fn("loadIdentityEffect")(function*() {
  let installId = yield* storageGetEffect(localStorage, deviceIdKey);
  if (!installId) {
    installId = randomDeviceId();
    yield* storageSetEffect(localStorage, deviceIdKey, installId);
  }

  let peerSessionId = yield* storageGetEffect(sessionStorage, peerSessionIdKey);
  if (!peerSessionId) {
    peerSessionId = `${installId}:${randomDeviceId()}`;
    yield* storageSetEffect(sessionStorage, peerSessionIdKey, peerSessionId);
  }

  const savedDisplayName = yield* storageGetEffect(localStorage, displayNameKey);

  return {
    device_id: peerSessionId,
    display_name: savedDisplayName || defaultDisplayName,
    display_name_is_default: !savedDisplayName || savedDisplayName === defaultDisplayName,
    device_profile: unknownDeviceProfile(),
  };
});

export const saveDisplayNameEffect = Effect.fn("saveDisplayNameEffect")(function*(
  displayName: string,
) {
  return yield* storageSetEffect(localStorage, displayNameKey, displayName);
});

export const loadDetectedProfileEffect = Effect.fn("loadDetectedProfileEffect")(function*() {
  const profile = yield* Effect.tryPromise({
    try: () => detectDeviceProfile(),
    catch: () =>
      DeviceProfileDetectionError.make({
        message: "Device profile could not be detected.",
      }),
  });
  return {
    profile,
    generated_display_name: generatedDisplayName(profile),
  };
});

function randomDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `device_${Math.random().toString(36).slice(2)}`;
}

function storageGetEffect(storage: Storage, key: string): Effect.Effect<string | null, IdentityStorageError> {
  return Effect.try({
    try: () => storage.getItem(key),
    catch: () =>
      IdentityStorageError.make({
        message: "Browser storage could not be read.",
      }),
  });
}

function storageSetEffect(
  storage: Storage,
  key: string,
  value: string,
): Effect.Effect<void, IdentityStorageError> {
  return Effect.try({
    try: () => storage.setItem(key, value),
    catch: () =>
      IdentityStorageError.make({
        message: "Browser storage could not be written.",
      }),
  });
}

function fallbackIdentity(): Identity {
  const installId = randomDeviceId();
  return {
    device_id: `${installId}:${randomDeviceId()}`,
    display_name: defaultDisplayName,
    display_name_is_default: true,
    device_profile: unknownDeviceProfile(),
  };
}
