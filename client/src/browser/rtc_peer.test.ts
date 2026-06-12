import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closePeerConnection, startSenderPeerConnection } from "./rtc_peer";

type FakeDescription = {
  type: "offer" | "answer";
  sdp: string;
};

class FakeDataChannel {
  constructor(readonly label: string) {}

  close = vi.fn();
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];

  localDescription: FakeDescription | null = null;
  connectionState: RTCPeerConnectionState = "new";
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  createdChannels: Array<{ label: string; options?: RTCDataChannelInit }> = [];

  constructor(readonly configuration: RTCConfiguration) {
    FakePeerConnection.instances.push(this);
  }

  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
    this.createdChannels.push({ label, options });
    return new FakeDataChannel(label) as unknown as RTCDataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "opaque-offer" };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as FakeDescription;
  }

  close = vi.fn();
}

describe("rtc peer sender setup", () => {
  const originalPeerConnection = globalThis.RTCPeerConnection;

  beforeEach(() => {
    FakePeerConnection.instances = [];
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  });

  afterEach(() => {
    closePeerConnection("transfer_1");
    vi.unstubAllGlobals();
    if (originalPeerConnection) {
      vi.stubGlobal("RTCPeerConnection", originalPeerConnection);
    }
  });

  test("creates ordered control and unordered data channels before sending offer", async () => {
    const sendSignal = vi.fn();

    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal,
    });

    expect(FakePeerConnection.instances).toHaveLength(1);
    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    expect(instance.configuration).toEqual({
      iceServers: [],
    });
    expect(instance.createdChannels).toEqual([
      { label: "control", options: { ordered: true } },
      { label: "data", options: { ordered: false } },
    ]);
    expect(sendSignal).toHaveBeenCalledWith({
      to: "bob",
      transfer_id: "transfer_1",
      correlation_id: "rtc_transfer_1",
      description: "offer",
      payload: "{\"type\":\"offer\",\"sdp\":\"opaque-offer\"}",
    });
  });
});
