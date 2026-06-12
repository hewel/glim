export async function hashFilePieces(file: File, pieceSize: number): Promise<string[]> {
  if (pieceSize <= 0) {
    throw new Error("Piece size must be positive.");
  }

  const hashes: string[] = [];
  for (let offset = 0; offset < file.size; offset += pieceSize) {
    const end = Math.min(offset + pieceSize, file.size);
    const bytes = await file.slice(offset, end).arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    hashes.push(hex(hash));
  }

  return hashes;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
