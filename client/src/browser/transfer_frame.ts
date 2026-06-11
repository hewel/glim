const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface FileChunkHeader {
  type: "file.chunk";
  transfer_id: string;
  sequence: number;
  offset: number;
  byte_length: number;
  final: boolean;
}

export interface DecodedFileChunk {
  transfer_id: string;
  sequence: number;
  offset: number;
  byte_length: number;
  final: boolean;
  bytes: ArrayBuffer;
}

export function encodeChunkFrame(header: FileChunkHeader, bytes: ArrayBuffer): ArrayBuffer {
  const headerBytes = textEncoder.encode(JSON.stringify(header));
  const chunkBytes = new Uint8Array(bytes);
  const frame = new Uint8Array(4 + headerBytes.byteLength + chunkBytes.byteLength);
  const view = new DataView(frame.buffer);

  view.setUint32(0, headerBytes.byteLength);
  frame.set(headerBytes, 4);
  frame.set(chunkBytes, 4 + headerBytes.byteLength);

  return frame.buffer;
}

export function decodeChunkFrame(frame: ArrayBuffer): DecodedFileChunk {
  if (frame.byteLength < 4) {
    throw new Error("Invalid file chunk.");
  }

  const view = new DataView(frame);
  const headerLength = view.getUint32(0);
  if (headerLength <= 0 || 4 + headerLength > frame.byteLength) {
    throw new Error("Invalid file chunk.");
  }

  const headerBytes = new Uint8Array(frame, 4, headerLength);
  const header = parseHeader(JSON.parse(textDecoder.decode(headerBytes)));
  const bytes = frame.slice(4 + headerLength);
  if (bytes.byteLength !== header.byte_length) {
    throw new Error("Invalid file chunk.");
  }

  return {
    transfer_id: header.transfer_id,
    sequence: header.sequence,
    offset: header.offset,
    byte_length: header.byte_length,
    final: header.final,
    bytes,
  };
}

function parseHeader(value: unknown): FileChunkHeader {
  if (!isRecord(value)) {
    throw new Error("Invalid file chunk.");
  }

  const header = value as Partial<FileChunkHeader>;
  if (
    header.type !== "file.chunk" ||
    typeof header.transfer_id !== "string" ||
    typeof header.sequence !== "number" ||
    typeof header.offset !== "number" ||
    typeof header.byte_length !== "number" ||
    typeof header.final !== "boolean"
  ) {
    throw new Error("Invalid file chunk.");
  }

  return {
    type: "file.chunk",
    transfer_id: header.transfer_id,
    sequence: header.sequence,
    offset: header.offset,
    byte_length: header.byte_length,
    final: header.final,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
