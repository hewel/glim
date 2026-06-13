import { describe, expect, test } from "vitest";
import {
  reselectedFileManifestId,
  reselectedFileMatchesManifest,
} from "./senderResume";
import type { FileSelection, TransferItem } from "./types";

const transfer: TransferItem = {
  transfer_id: "transfer_1",
  peer_id: "peer_1",
  peer_name: "Peer",
  name: "demo.bin",
  mime_type: "application/octet-stream",
  size: 9,
  transferred: 0,
  direction: "sending",
  mode: "p2p",
  status: "resumable",
  notice: "Reselect the original file to resume sending.",
};

const selection: FileSelection = {
  transfer_id: "new_transfer_id",
  file_id: "file_1",
  name: "demo.bin",
  size: 9,
  mime_type: "application/octet-stream",
};

describe("sender resume manifest verification", () => {
  test("accepts a reselected file only when its manifest identity matches", async () => {
    const hashFile = async () => [
      "d80ce8c557265e19007dfaae729015d097196d27e0fd21f58238981277845fe9",
    ];
    const expectedManifestId = await reselectedFileManifestId(selection, transfer, hashFile);

    expect(expectedManifestId).toMatch(/^manifest_/);
    await expect(
      reselectedFileMatchesManifest(
        selection,
        transfer,
        expectedManifestId ?? "",
        hashFile,
      ),
    ).resolves.toBe(true);
    await expect(
      reselectedFileMatchesManifest(selection, transfer, "manifest_other", hashFile),
    ).resolves.toBe(false);
  });
});
