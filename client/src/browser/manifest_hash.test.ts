import { describe, expect, test } from "vitest";
import { hashFilePieces } from "./manifest_hash";

describe("manifest hashing handoff", () => {
  test("hashes file pieces with Web Crypto without building protocol messages", async () => {
    const file = new File([new Uint8Array([97, 98, 99])], "clip.txt", {
      type: "text/plain",
    });

    const hashes = await hashFilePieces(file, 2);

    expect(hashes).toEqual([
      "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      "2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6",
    ]);
  });
});
