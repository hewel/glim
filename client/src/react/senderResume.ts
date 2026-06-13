import * as core from "../core.gleam";
import type { FileSelection, TransferItem } from "./types";

export type HashFilePieces = (fileId: string, pieceSize: number) => Promise<string[]>;

export async function reselectedFileManifestId(
  selection: FileSelection,
  transfer: TransferItem,
  hashFilePieces: HashFilePieces,
): Promise<string | null> {
  const pieceSize = core.default_manifest_piece_size();
  const pieceHashes = await hashFilePieces(selection.file_id, pieceSize);
  const controlMessage = core.encode_transfer_offer_control_from_dynamic_hashes(
    transfer.transfer_id,
    selection.file_id,
    transfer.name,
    transfer.size,
    transfer.mime_type,
    pieceSize,
    pieceHashes,
  );

  return transferOfferManifestId(controlMessage);
}

export async function reselectedFileMatchesManifest(
  selection: FileSelection,
  transfer: TransferItem,
  expectedManifestId: string,
  hashFilePieces: HashFilePieces,
): Promise<boolean> {
  const manifestId = await reselectedFileManifestId(selection, transfer, hashFilePieces);
  return manifestId === expectedManifestId;
}

function transferOfferManifestId(controlMessage: string): string | null {
  try {
    const parsed = JSON.parse(controlMessage) as {
      manifest?: { manifest_id?: unknown };
    };
    return typeof parsed.manifest?.manifest_id === "string"
      ? parsed.manifest.manifest_id
      : null;
  } catch (_error) {
    return null;
  }
}
