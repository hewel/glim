import { describe, expect, test } from "vitest";
import * as core from "../core.gleam";

describe("client core RTC manifest helpers", () => {
  test("encodes a valid transfer offer control message without throwing", () => {
    expect(() =>
      core.encode_transfer_offer_control_from_dynamic_hashes(
        "transfer_1",
        "file_1",
        "demo.bin",
        9,
        "application/octet-stream",
        8_388_608,
        ["d80ce8c557265e19007dfaae729015d097196d27e0fd21f58238981277845fe9"],
      )
    ).not.toThrow();

    const raw = core.encode_transfer_offer_control_from_dynamic_hashes(
      "transfer_1",
      "file_1",
      "demo.bin",
      9,
      "application/octet-stream",
      8_388_608,
      ["d80ce8c557265e19007dfaae729015d097196d27e0fd21f58238981277845fe9"],
    );

    expect(JSON.parse(raw)).toMatchObject({
      type: "transfer.offer",
      room_transfer_id: "transfer_1",
      manifest: {
        version: 1,
        piece_size: 8_388_608,
        files: [
          {
            file_id: "file_1",
            name: "demo.bin",
            size: 9,
            mime_type: "application/octet-stream",
            pieces: [
              {
                index: 0,
                size: 9,
                sha256: "d80ce8c557265e19007dfaae729015d097196d27e0fd21f58238981277845fe9",
              },
            ],
          },
        ],
      },
    });
  });
});
