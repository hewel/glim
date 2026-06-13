import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  closePeerConnection,
  handleRtcSignal,
  hasPeerConnection,
  sendControlMessage,
  sendDataFrameWithBackpressure,
  startSenderPeerConnection,
} from "./rtc_peer";

type FakeDescription = {
  type: "offer" | "answer";
  sdp: string;
};

class FakeDataChannel {
  constructor(readonly label: string) {}

  onmessage: ((event: MessageEvent) => void) | null = null;
  onbufferedamountlow: ((event: Event) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState: RTCDataChannelState = "open";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  send = vi.fn();
  close = vi.fn();
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  static deferRemoteDescription = false;
  static remoteDescriptionResolvers: Array<() => void> = [];

  localDescription: FakeDescription | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  connectionState: RTCPeerConnectionState = "new";
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  createdChannels: Array<{ label: string; options?: RTCDataChannelInit }> = [];
  channels: FakeDataChannel[] = [];
  addedIceCandidates: RTCIceCandidateInit[] = [];

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
    if (FakePeerConnection.deferRemoteDescription) {
      await new Promise<void>((resolve) => {
        FakePeerConnection.remoteDescriptionResolvers.push(() => {
          this.remoteDescription = description;
          resolve();
        });
      });
      return;
    }

    this.remoteDescription = description;
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.remoteDescription) {
      throw new Error("remote description is missing");
    }

    this.addedIceCandidates.push(candidate);
  }

  close = vi.fn();
}

describe("rtc peer sender setup", () => {
  const originalPeerConnection = globalThis.RTCPeerConnection;

  beforeEach(() => {
    FakePeerConnection.instances = [];
    FakePeerConnection.deferRemoteDescription = false;
    FakePeerConnection.remoteDescriptionResolvers = [];
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

  test("queues ICE candidates that arrive before the sender accepts an answer", async () => {
    const sendSignal = vi.fn();
    const onFailed = vi.fn();
    const candidate = {
      candidate: "candidate:0 1 UDP 2122252543 peer.local 47395 typ host",
      sdpMLineIndex: 0,
      sdpMid: "0",
      usernameFragment: "98ee72e9",
    };

    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal,
      onFailed,
    });

    await handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "bob",
        to: "alice",
        description: "ice",
        payload: JSON.stringify(candidate),
      },
      sendSignal,
      onFailed,
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    expect(onFailed).not.toHaveBeenCalled();
    expect(instance.addedIceCandidates).toEqual([]);

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
      onFailed,
    });

    expect(instance.remoteDescription).toEqual({
      type: "answer",
      sdp: "opaque-answer",
    });
    expect(instance.addedIceCandidates).toEqual([candidate]);
  });

  test("adds ICE candidates immediately after the sender accepts an answer", async () => {
    const sendSignal = vi.fn();
    const onFailed = vi.fn();
    const candidate = {
      candidate: "candidate:0 1 UDP 2122252543 peer.local 47395 typ host",
      sdpMLineIndex: 0,
      sdpMid: "0",
      usernameFragment: "98ee72e9",
    };

    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal,
      onFailed,
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
      onFailed,
    });
    await handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "bob",
        to: "alice",
        description: "ice",
        payload: JSON.stringify(candidate),
      },
      sendSignal,
      onFailed,
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    expect(onFailed).not.toHaveBeenCalled();
    expect(instance.addedIceCandidates).toEqual([candidate]);
  });

  test("flushes queued ICE candidates after the receiver accepts an offer", async () => {
    FakePeerConnection.deferRemoteDescription = true;
    const sendSignal = vi.fn();
    const onFailed = vi.fn();
    const candidate = {
      candidate: "candidate:0 1 UDP 2122252543 peer.local 47395 typ host",
      sdpMLineIndex: 0,
      sdpMid: "0",
      usernameFragment: "98ee72e9",
    };

    const offerPromise = handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "alice",
        to: "bob",
        description: "offer",
        payload: "{\"type\":\"offer\",\"sdp\":\"opaque-offer\"}",
      },
      sendSignal,
      onFailed,
    });
    await Promise.resolve();

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    await handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "alice",
        to: "bob",
        description: "ice",
        payload: JSON.stringify(candidate),
      },
      sendSignal,
      onFailed,
    });

    expect(onFailed).not.toHaveBeenCalled();
    expect(instance.addedIceCandidates).toEqual([]);

    FakePeerConnection.remoteDescriptionResolvers[0]?.();
    await offerPromise;

    expect(instance.remoteDescription).toEqual({
      type: "offer",
      sdp: "opaque-offer",
    });
    expect(instance.addedIceCandidates).toEqual([candidate]);
  });

  test("reports malformed ICE payloads as RTC ICE errors", async () => {
    const sendSignal = vi.fn();
    const onFailed = vi.fn();

    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal,
      onFailed,
    });

    await handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "bob",
        to: "alice",
        description: "ice",
        payload: "not json",
      },
      sendSignal,
      onFailed,
    });

    expect(onFailed).toHaveBeenCalledWith(
      "transfer_1",
      "RTC ICE candidate was invalid.",
    );
  });

  test("closing a peer connection drops queued ICE candidates", async () => {
    const sendSignal = vi.fn();
    const onFailed = vi.fn();
    const candidate = {
      candidate: "candidate:0 1 UDP 2122252543 peer.local 47395 typ host",
      sdpMLineIndex: 0,
      sdpMid: "0",
      usernameFragment: "98ee72e9",
    };

    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal,
      onFailed,
    });
    await handleRtcSignal({
      signal: {
        transfer_id: "transfer_1",
        correlation_id: "rtc_transfer_1",
        from: "bob",
        to: "alice",
        description: "ice",
        payload: JSON.stringify(candidate),
      },
      sendSignal,
      onFailed,
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    closePeerConnection("transfer_1");
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
      onFailed,
    });

    expect(instance.addedIceCandidates).toEqual([]);
    expect(onFailed).toHaveBeenCalledWith(
      "transfer_1",
      "RTC connection was not found.",
    );
  });

  test("reports connected only after the peer connection and both channels are open", async () => {
    const onConnected = vi.fn();

    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal: vi.fn(),
      onConnected,
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }
    const controlChannel = instance.channels.find((channel) => channel.label === "control");
    const dataChannel = instance.channels.find((channel) => channel.label === "data");
    if (!controlChannel || !dataChannel) {
      throw new Error("expected transfer channels");
    }

    controlChannel.readyState = "connecting";
    dataChannel.readyState = "connecting";
    instance.connectionState = "connected";
    instance.onconnectionstatechange?.();

    expect(onConnected).not.toHaveBeenCalled();

    controlChannel.readyState = "open";
    controlChannel.onopen?.();
    expect(onConnected).not.toHaveBeenCalled();

    dataChannel.readyState = "open";
    dataChannel.onopen?.();
    expect(onConnected).toHaveBeenCalledOnce();
    expect(onConnected).toHaveBeenCalledWith("transfer_1");
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

  test("receiver forwards data channel frames with the transfer id", async () => {
    const sendSignal = vi.fn();
    const onDataFrame = vi.fn();

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
      onDataFrame,
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }

    const channel = new FakeDataChannel("data");
    const frame = new Uint8Array([1, 2, 3]).buffer;
    instance.ondatachannel?.({ channel } as unknown as RTCDataChannelEvent);
    channel.onmessage?.({ data: frame } as MessageEvent);

    expect(onDataFrame).toHaveBeenCalledWith("transfer_1", frame);
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

  test("waits for data channel backpressure before sending frames", async () => {
    await startSenderPeerConnection({
      transferId: "transfer_1",
      to: "bob",
      sendSignal: vi.fn(),
    });

    const instance = FakePeerConnection.instances[0];
    if (!instance) {
      throw new Error("expected fake connection");
    }
    const dataChannel = instance.channels.find((channel) => channel.label === "data");
    if (!dataChannel) {
      throw new Error("expected data channel");
    }

    dataChannel.bufferedAmount = 20;
    const frame = new Uint8Array([1, 2, 3]).buffer;
    const sendPromise = sendDataFrameWithBackpressure("transfer_1", frame, {
      highWaterMark: 16,
      lowWaterMark: 4,
    });

    await Promise.resolve();

    expect(dataChannel.bufferedAmountLowThreshold).toBe(4);
    expect(dataChannel.send).not.toHaveBeenCalled();

    dataChannel.bufferedAmount = 4;
    dataChannel.onbufferedamountlow?.(new Event("bufferedamountlow"));

    await expect(sendPromise).resolves.toBe(true);
    expect(dataChannel.send).toHaveBeenCalledWith(frame);
  });
});
