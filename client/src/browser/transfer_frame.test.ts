import { describe, expect, test } from "vitest";
import { decodeChunkFrame, encodeChunkFrame } from "./transfer_frame";
import { chunkSize } from "../react/domain";

describe("transfer frame codec", () => {
  test("round-trips file chunk frames", () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const frame = encodeChunkFrame(
      {
        type: "file.chunk",
        transfer_id: "transfer_1",
        sequence: 2,
        offset: 512,
        byte_length: 3,
        final: true,
      },
      bytes,
    );

    const decoded = decodeChunkFrame(frame);

    expect(decoded.transfer_id).toBe("transfer_1");
    expect(decoded.sequence).toBe(2);
    expect(decoded.offset).toBe(512);
    expect(decoded.byte_length).toBe(3);
    expect(decoded.final).toBe(true);
    expect([...new Uint8Array(decoded.bytes)]).toEqual([1, 2, 3]);
  });

  test("rejects invalid chunk frames", () => {
    expect(() => decodeChunkFrame(new Uint8Array([1, 2]).buffer)).toThrow();
  });

  test("keeps encoded P2P frames under Chrome's 256 KiB DataChannel message limit", () => {
    const bytes = new Uint8Array(chunkSize).buffer;
    const frame = encodeChunkFrame(
      {
        type: "file.chunk",
        transfer_id: "transfer_bst1lbb02f4mqcau6f5",
        sequence: 3015,
        offset: 790_364_160,
        byte_length: chunkSize,
        final: false,
      },
      bytes,
    );

    expect(frame.byteLength).toBeLessThanOrEqual(262_144);
  });
});
