import type { OutgoingRtcSignal, RtcSignal } from "../react/types";

export interface RtcPeerHandle {
  connection: RTCPeerConnection;
  controlChannel?: RTCDataChannel;
  dataChannel?: RTCDataChannel;
}

export interface RtcPeerCallbacks {
  sendSignal: (signal: OutgoingRtcSignal) => void;
  onConnected?: (transferId: string) => void;
  onFailed?: (transferId: string, reason: string) => void;
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

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  sendDescription(options, options.to, "offer", connection.localDescription ?? offer);
}

export async function handleRtcSignal(options: ReceiverOptions): Promise<void> {
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
    case "ice":
      await acceptIceCandidate(options);
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
      return;
    }

    if (event.channel.label === "data") {
      peerHandles.set(options.signal.transfer_id, {
        ...handle,
        dataChannel: event.channel,
      });
    }
  };
  peerHandles.set(options.signal.transfer_id, { connection });

  await connection.setRemoteDescription(offer);
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
}

async function acceptIceCandidate(options: ReceiverOptions): Promise<void> {
  const handle = peerHandles.get(options.signal.transfer_id);
  if (!handle) {
    return;
  }

  try {
    await handle.connection.addIceCandidate(JSON.parse(options.signal.payload));
  } catch (_error) {
    options.onFailed?.(options.signal.transfer_id, "RTC ICE candidate was invalid.");
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
        callbacks.onConnected?.(transferId);
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
