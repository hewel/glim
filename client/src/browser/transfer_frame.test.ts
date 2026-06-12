import { describe, expect, test } from "vitest";
import { decodeChunkFrame, encodeChunkFrame } from "./transfer_frame";

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
});
