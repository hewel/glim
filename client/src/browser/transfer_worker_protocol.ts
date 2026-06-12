import type { DecodedFileChunk } from "./transfer_frame";

export type WorkerRequest =
  | { id: number; type: "register_file"; file_id: string; file: File }
  | { id: number; type: "hash_file"; file_id: string; piece_size: number }
  | {
      id: number;
      type: "encode_chunk";
      file_id: string;
      transfer_id: string;
      sequence: number;
      offset: number;
      chunk_size: number;
    }
  | { id: number; type: "decode_chunk"; frame: ArrayBuffer };

export type WorkerRequestBody = WorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, "id">
    : never
  : never;

export type WorkerResponse =
  | { id: number; type: "registered" }
  | { id: number; type: "hashed"; piece_hashes: string[] }
  | { id: number; type: "encoded"; frame: ArrayBuffer }
  | { id: number; type: "decoded"; chunk: DecodedFileChunk }
  | { id: number; type: "error"; reason: string };
