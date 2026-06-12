import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  closePeerConnection,
  handleRtcSignal,
  hasPeerConnection,
  sendControlMessage,
  startSenderPeerConnection,
} from "./rtc_peer";

type FakeDescription = {
  type: "offer" | "answer";
  sdp: string;
};

class FakeDataChannel {
  constructor(readonly label: string) {}

  onmessage: ((event: MessageEvent) => void) | null = null;
  readyState: RTCDataChannelState = "open";
  send = vi.fn();
  close = vi.fn();
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];

  localDescription: FakeDescription | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  connectionState: RTCPeerConnectionState = "new";
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  createdChannels: Array<{ label: string; options?: RTCDataChannelInit }> = [];
  channels: FakeDataChannel[] = [];

  constructor(readonly configuration: RTCConfiguration) {
    FakePeerConnection.instances.push(this);
  }

  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
    this.createdChannels.push({ label, options });
    const channel = new FakeDataChannel(label);
    this.channels.push(channel);
    return channel as unknown as RTCDataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "opaque-offer" };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "opaque-answer" };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as FakeDescription;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description;
  }

  async addIceCandidate(_candidate: RTCIceCandidateInit): Promise<void> {}

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

  test("receiver accepts an offer and sends an answer signal", async () => {
    const sendSignal = vi.fn();

    await handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "alice",
        to: "bob",
        description: "offer",
        payload: "{\"type\":\"offer\",\"sdp\":\"opaque-offer\"}",
      },
      sendSignal,
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    expect(hasPeerConnection("transfer_1")).toBe(true);
    expect(instance.remoteDescription).toEqual({
      type: "offer",
      sdp: "opaque-offer",
    });
    expect(instance.localDescription).toEqual({
      type: "answer",
      sdp: "opaque-answer",
    });
    expect(sendSignal).toHaveBeenCalledWith({
      to: "alice",
      transfer_id: "transfer_1",
      correlation_id: "rtc_transfer_1",
      description: "answer",
      payload: "{\"type\":\"answer\",\"sdp\":\"opaque-answer\"}",
    });
  });

  test("sender accepts an answer on the existing peer connection", async () => {
    const sendSignal = vi.fn();

    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal,
    });
    await handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "bob",
        to: "alice",
        description: "answer",
        payload: "{\"type\":\"answer\",\"sdp\":\"opaque-answer\"}",
      },
      sendSignal,
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    expect(instance.remoteDescription).toEqual({
      type: "answer",
      sdp: "opaque-answer",
    });
  });

  test("receiver forwards control channel messages with the transfer id", async () => {
    const sendSignal = vi.fn();
    const onControlMessage = vi.fn();

    await handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "alice",
        to: "bob",
        description: "offer",
        payload: "{\"type\":\"offer\",\"sdp\":\"opaque-offer\"}",
      },
      sendSignal,
      onControlMessage,
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    const channel = new FakeDataChannel("control");
    instance.ondatachannel?.({ channel } as unknown as RTCDataChannelEvent);
    channel.onmessage?.({ data: "{\"type\":\"transfer.offer\"}" } as MessageEvent);

    expect(onControlMessage).toHaveBeenCalledWith(
      "transfer_1",
      "{\"type\":\"transfer.offer\"}",
    );
  });

  test("sends control messages over the transfer control channel", async () => {
    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal: vi.fn(),
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }
    const controlChannel = instance.channels.find((channel) => channel.label === "control");

    expect(controlChannel).toBeDefined();
    expect(sendControlMessage("transfer_1", "{\"type\":\"transfer.offer\"}")).toBe(true);
    expect(controlChannel?.send).toHaveBeenCalledWith("{\"type\":\"transfer.offer\"}");
  });
});
