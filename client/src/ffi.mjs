let socket = null;
const selectedFiles = new Map();
const receiveWriters = new Map();
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function loadIdentity() {
  let deviceId = localStorage.getItem("glim.device_id");
  if (!deviceId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = "device_" + Math.random().toString(36).slice(2);
    }
    localStorage.setItem("glim.device_id", deviceId);
  }

  return {
    device_id: deviceId,
    display_name: localStorage.getItem("glim.display_name") || "Glim Peer",
  };
}

export function connect(
  displayName,
  helloJson,
  onOpen,
  onClose,
  onError,
  onMessage,
  onChunkWritten,
  onReceiveError,
) {
  localStorage.setItem("glim.display_name", displayName);

  if (socket) {
    socket.close();
  }

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(protocol + "//" + location.host + "/ws");
  socket.binaryType = "arraybuffer";

  socket.addEventListener("open", function () {
    socket.send(helloJson);
    onOpen();
  });

  socket.addEventListener("message", function (event) {
    if (typeof event.data === "string") {
      onMessage(event.data);
    } else if (event.data instanceof ArrayBuffer) {
      writeIncomingChunk(event.data, onChunkWritten, onReceiveError);
    }
  });

  socket.addEventListener("close", function () {
    onClose();
  });

  socket.addEventListener("error", function () {
    onError();
  });
}

export function send(payload, onError) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(payload);
  } else {
    onError();
  }
}

export function selectFile(onSelected, onError) {
  const input = document.createElement("input");
  input.type = "file";
  input.style.display = "none";
  input.addEventListener("change", function () {
    const file = input.files && input.files[0];
    input.remove();

    if (!file) {
      onError();
      return;
    }

    const fileId = randomId("file");
    const transferId = randomId("transfer");
    selectedFiles.set(fileId, file);
    onSelected({
      transfer_id: transferId,
      file_id: fileId,
      name: file.name || "download",
      size: file.size,
      mime_type: file.type || "application/octet-stream",
    });
  });
  document.body.appendChild(input);
  input.click();
}

export function streamSaveSupported() {
  return typeof window.showSaveFilePicker === "function";
}

export async function startReceiveFile(
  transferId,
  name,
  onReady,
  onError,
  onUnsupported,
) {
  if (!streamSaveSupported()) {
    onUnsupported();
    return;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: name || "download",
    });
    const writer = await handle.createWritable();
    receiveWriters.set(transferId, writer);
    onReady();
  } catch (error) {
    onError(error && error.name === "AbortError" ? "Save cancelled." : "Save target could not be opened.");
  }
}

export async function sendFileChunk(
  fileId,
  transferId,
  sequence,
  offset,
  chunkSize,
  onError,
) {
  const file = selectedFiles.get(fileId);
  if (!file || !socket || socket.readyState !== WebSocket.OPEN) {
    onError();
    return;
  }

  try {
    const end = Math.min(offset + chunkSize, file.size);
    const bytes = await file.slice(offset, end).arrayBuffer();
    const header = {
      type: "file.chunk",
      transfer_id: transferId,
      sequence,
      offset,
      byte_length: bytes.byteLength,
      final: end >= file.size,
    };
    socket.send(encodeChunkFrame(header, bytes));
  } catch (_error) {
    onError();
  }
}

export function closeReceiveFile(transferId) {
  const writer = receiveWriters.get(transferId);
  receiveWriters.delete(transferId);

  if (writer) {
    try {
      writer.close();
    } catch (_error) {
      // The transfer may already have closed or aborted.
    }
  }
}

export function formatTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function randomId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return prefix + "_" + crypto.randomUUID();
  }

  return prefix + "_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function encodeChunkFrame(header, bytes) {
  const headerBytes = textEncoder.encode(JSON.stringify(header));
  const chunkBytes = new Uint8Array(bytes);
  const frame = new Uint8Array(4 + headerBytes.byteLength + chunkBytes.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint32(0, headerBytes.byteLength);
  frame.set(headerBytes, 4);
  frame.set(chunkBytes, 4 + headerBytes.byteLength);
  return frame.buffer;
}

async function writeIncomingChunk(frame, onChunkWritten, onReceiveError) {
  try {
    if (frame.byteLength < 4) {
      onReceiveError("", "Invalid file chunk.");
      return;
    }

    const view = new DataView(frame);
    const headerLength = view.getUint32(0);
    if (headerLength <= 0 || 4 + headerLength > frame.byteLength) {
      onReceiveError("", "Invalid file chunk.");
      return;
    }

    const headerBytes = new Uint8Array(frame, 4, headerLength);
    const header = JSON.parse(textDecoder.decode(headerBytes));
    const chunk = new Uint8Array(frame, 4 + headerLength);
    const writer = receiveWriters.get(header.transfer_id);

    if (!writer) {
      onReceiveError(header.transfer_id || "", "No save target is open for this transfer.");
      return;
    }

    await writer.write(chunk);

    if (header.final) {
      await writer.close();
      receiveWriters.delete(header.transfer_id);
    }

    onChunkWritten({
      transfer_id: header.transfer_id,
      sequence: header.sequence,
      offset: header.offset,
      byte_length: header.byte_length,
      final: header.final,
    });
  } catch (_error) {
    onReceiveError("", "File chunk could not be written.");
  }
}
