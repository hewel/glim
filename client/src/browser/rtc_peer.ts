import type { OutgoingRtcSignal, RtcSignal } from "../react/types";

export interface RtcPeerHandle {
  connection: RTCPeerConnection;
  controlChannel?: RTCDataChannel;
  dataChannel?: RTCDataChannel;
  connectedNotified?: boolean;
  pendingIceCandidates?: RTCIceCandidateInit[];
}

export interface RtcPeerCallbacks {
  sendSignal: (signal: OutgoingRtcSignal) => void;
  onConnected?: (transferId: string) => void;
  onFailed?: (transferId: string, reason: string) => void;
  onControlMessage?: (transferId: string, raw: string) => void;
  onDataFrame?: (transferId: string, frame: ArrayBuffer) => void;
}

interface SenderOptions extends RtcPeerCallbacks {
  transferId: string;
  to: string;
}

interface ReceiverOptions extends RtcPeerCallbacks {
  signal: RtcSignal;
}

type RtcPeerOptions = SenderOptions | ReceiverOptions;

const peerHandles = new Map<string, RtcPeerHandle>();
const defaultHighWaterMark = 16 * 1024 * 1024;
const defaultLowWaterMark = 4 * 1024 * 1024;

export async function startSenderPeerConnection(options: SenderOptions): Promise<void> {
  const connection = createPeerConnection(options.transferId, options);
  const controlChannel = connection.createDataChannel("control", {
    ordered: true,
  });
  const dataChannel = connection.createDataChannel("data", {
    ordered: false,
  });
  peerHandles.set(options.transferId, {
    connection,
    controlChannel,
    dataChannel,
  });
  configureControlChannel(options.transferId, controlChannel, options);
  configureDataChannel(options.transferId, dataChannel, options);

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  sendDescription(options, options.to, "offer", connection.localDescription ?? offer);
}

export async function handleRtcSignal(options: ReceiverOptions): Promise<void> {
  if (options.signal.description === "ice") {
    await acceptIceCandidate(options);
    return;
  }

  const description = parseDescription(options.signal);
  if (!description) {
    options.onFailed?.(options.signal.transfer_id, "RTC signal payload was invalid.");
    return;
  }

  switch (options.signal.description) {
    case "offer":
      await acceptOffer(options, description);
      break;
    case "answer":
      await acceptAnswer(options, description);
      break;
    default:
      options.onFailed?.(options.signal.transfer_id, "RTC signal type was unsupported.");
  }
}

export function closePeerConnection(transferId: string): void {
  const handle = peerHandles.get(transferId);
  peerHandles.delete(transferId);
  handle?.controlChannel?.close();
  handle?.dataChannel?.close();
  handle?.connection.close();
}

export function hasPeerConnection(transferId: string): boolean {
  return peerHandles.has(transferId);
}

export function sendControlMessage(transferId: string, raw: string): boolean {
  const channel = peerHandles.get(transferId)?.controlChannel;
  if (!channel || channel.readyState !== "open") {
    return false;
  }

  channel.send(raw);
  return true;
}

export async function sendDataFrameWithBackpressure(
  transferId: string,
  frame: ArrayBuffer,
  thresholds: {
    highWaterMark?: number;
    lowWaterMark?: number;
  } = {},
): Promise<boolean> {
  const channel = peerHandles.get(transferId)?.dataChannel;
  if (!channel || channel.readyState !== "open") {
    return false;
  }

  const highWaterMark = thresholds.highWaterMark ?? defaultHighWaterMark;
  const lowWaterMark = thresholds.lowWaterMark ?? defaultLowWaterMark;
  if (channel.bufferedAmount > highWaterMark) {
    await waitForBufferedAmountLow(channel, lowWaterMark);
  }

  if (channel.readyState !== "open") {
    return false;
  }

  channel.send(frame);
  return true;
}

async function acceptOffer(
  options: ReceiverOptions,
  offer: RTCSessionDescriptionInit,
): Promise<void> {
  const connection = createPeerConnection(options.signal.transfer_id, options);
  connection.ondatachannel = (event) => {
    const handle = peerHandles.get(options.signal.transfer_id);
    if (!handle) {
      return;
    }

    if (event.channel.label === "control") {
      peerHandles.set(options.signal.transfer_id, {
        ...handle,
        controlChannel: event.channel,
      });
      configureControlChannel(options.signal.transfer_id, event.channel, options);
      return;
    }

    if (event.channel.label === "data") {
      peerHandles.set(options.signal.transfer_id, {
        ...handle,
        dataChannel: event.channel,
      });
      configureDataChannel(options.signal.transfer_id, event.channel, options);
    }
  };
  peerHandles.set(options.signal.transfer_id, { connection });

  await connection.setRemoteDescription(offer);
  await flushPendingIceCandidates(options.signal.transfer_id, options);
  const answer = await connection.createAnswer();
  await connection.setLocalDescription(answer);
  sendDescription(
    options,
    options.signal.from,
    "answer",
    connection.localDescription ?? answer,
  );
}

async function acceptAnswer(
  options: ReceiverOptions,
  answer: RTCSessionDescriptionInit,
): Promise<void> {
  const handle = peerHandles.get(options.signal.transfer_id);
  if (!handle) {
    options.onFailed?.(options.signal.transfer_id, "RTC connection was not found.");
    return;
  }

  await handle.connection.setRemoteDescription(answer);
  await flushPendingIceCandidates(options.signal.transfer_id, options);
}

async function acceptIceCandidate(options: ReceiverOptions): Promise<void> {
  const handle = peerHandles.get(options.signal.transfer_id);
  if (!handle) {
    return;
  }

  let candidate: RTCIceCandidateInit;
  try {
    candidate = JSON.parse(options.signal.payload) as RTCIceCandidateInit;
  } catch (_error) {
    options.onFailed?.(options.signal.transfer_id, "RTC ICE candidate was invalid.");
    return;
  }

  if (!handle.connection.remoteDescription) {
    peerHandles.set(options.signal.transfer_id, {
      ...handle,
      pendingIceCandidates: [...(handle.pendingIceCandidates ?? []), candidate],
    });
    return;
  }

  await addIceCandidate(options.signal.transfer_id, handle.connection, candidate, options);
}

async function flushPendingIceCandidates(
  transferId: string,
  options: ReceiverOptions,
): Promise<void> {
  const handle = peerHandles.get(transferId);
  const pendingIceCandidates = handle?.pendingIceCandidates ?? [];
  if (!handle || pendingIceCandidates.length === 0) {
    return;
  }

  peerHandles.set(transferId, {
    ...handle,
    pendingIceCandidates: [],
  });

  for (const candidate of pendingIceCandidates) {
    await addIceCandidate(transferId, handle.connection, candidate, options);
  }
}

async function addIceCandidate(
  transferId: string,
  connection: RTCPeerConnection,
  candidate: RTCIceCandidateInit,
  options: ReceiverOptions,
): Promise<void> {
  try {
    await connection.addIceCandidate(candidate);
  } catch (_error) {
    options.onFailed?.(transferId, "RTC ICE candidate was invalid.");
  }
}

function createPeerConnection(
  transferId: string,
  callbacks: RtcPeerOptions,
): RTCPeerConnection {
  const connection = new RTCPeerConnection({ iceServers: [] });
  connection.onconnectionstatechange = () => {
    switch (connection.connectionState) {
      case "connected":
        notifyConnectedIfReady(transferId, callbacks);
        break;
      case "failed":
      case "closed":
      case "disconnected":
        callbacks.onFailed?.(transferId, "P2P setup failed before transfer progress.");
        break;
      default:
        break;
    }
  };
  connection.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    callbacks.sendSignal({
      to: signalTarget(callbacks),
      transfer_id: transferId,
      correlation_id: correlationId(transferId),
      description: "ice",
      payload: JSON.stringify(event.candidate.toJSON()),
    });
  };
  return connection;
}

function configureControlChannel(
  transferId: string,
  channel: RTCDataChannel,
  callbacks: RtcPeerOptions,
): void {
  channel.onopen = () => {
    notifyConnectedIfReady(transferId, callbacks);
  };
  channel.onmessage = (event) => {
    if (typeof event.data === "string") {
      callbacks.onControlMessage?.(transferId, event.data);
      return;
    }

    callbacks.onFailed?.(transferId, "RTC control message was invalid.");
  };
  notifyConnectedIfReady(transferId, callbacks);
}

function configureDataChannel(
  transferId: string,
  channel: RTCDataChannel,
  callbacks: RtcPeerOptions,
): void {
  channel.onopen = () => {
    notifyConnectedIfReady(transferId, callbacks);
  };
  channel.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      callbacks.onDataFrame?.(transferId, event.data);
      return;
    }

    callbacks.onFailed?.(transferId, "RTC data message was invalid.");
  };
  notifyConnectedIfReady(transferId, callbacks);
}

function notifyConnectedIfReady(
  transferId: string,
  callbacks: RtcPeerOptions,
): void {
  const handle = peerHandles.get(transferId);
  if (
    !handle ||
    handle.connectedNotified ||
    handle.connection.connectionState !== "connected" ||
    handle.controlChannel?.readyState !== "open" ||
    handle.dataChannel?.readyState !== "open"
  ) {
    return;
  }

  peerHandles.set(transferId, {
    ...handle,
    connectedNotified: true,
  });
  callbacks.onConnected?.(transferId);
}

function waitForBufferedAmountLow(
  channel: RTCDataChannel,
  lowWaterMark: number,
): Promise<void> {
  if (channel.bufferedAmount <= lowWaterMark) {
    return Promise.resolve();
  }

  channel.bufferedAmountLowThreshold = lowWaterMark;
  return new Promise((resolve) => {
    const previousHandler = channel.onbufferedamountlow;
    channel.onbufferedamountlow = (event) => {
      if (previousHandler) {
        previousHandler.call(channel, event);
      }
      resolve();
    };
  });
}

function sendDescription(
  callbacks: RtcPeerOptions,
  to: string,
  description: "offer" | "answer",
  payload: RTCSessionDescriptionInit,
): void {
  callbacks.sendSignal({
    to,
    transfer_id: transferIdFromDescription(payload, callbacks),
    correlation_id: correlationId(transferIdFromDescription(payload, callbacks)),
    description,
    payload: JSON.stringify(payload),
  });
}

function signalTarget(callbacks: RtcPeerOptions): string {
  return "to" in callbacks ? callbacks.to : callbacks.signal.from;
}

function transferIdFromDescription(
  _payload: RTCSessionDescriptionInit,
  callbacks: RtcPeerOptions,
): string {
  return "transferId" in callbacks
    ? callbacks.transferId
    : callbacks.signal.transfer_id;
}

function correlationId(transferId: string): string {
  return `rtc_${transferId}`;
}

function parseDescription(signal: RtcSignal): RTCSessionDescriptionInit | null {
  try {
    return JSON.parse(signal.payload) as RTCSessionDescriptionInit;
  } catch (_error) {
    return null;
  }
}
