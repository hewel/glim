import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeChunkFrame, encodeChunkFrame } from "./transfer_frame";

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

  assert.equal(decoded.transfer_id, "transfer_1");
  assert.equal(decoded.sequence, 2);
  assert.equal(decoded.offset, 512);
  assert.equal(decoded.byte_length, 3);
  assert.equal(decoded.final, true);
  assert.deepEqual([...new Uint8Array(decoded.bytes)], [1, 2, 3]);
});

test("rejects invalid chunk frames", () => {
  assert.throws(() => decodeChunkFrame(new Uint8Array([1, 2]).buffer));
});
