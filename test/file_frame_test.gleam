import file_frame
import gleam/bit_array
import gleeunit
import shared/protocol as shared_protocol

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn round_trip_chunk_frame_test() {
  let header =
    shared_protocol.FileChunkAck(
      transfer_id: "transfer_1",
      sequence: 1,
      offset: 4,
      byte_length: 5,
      final: False,
    )
  let chunk = bit_array.from_string("hello")
  let frame = file_frame.encode_chunk_frame(header, chunk)

  let assert Ok(file_frame.ChunkFrame(header: decoded, chunk: decoded_chunk)) =
    file_frame.decode_chunk_frame(frame)
  let assert True = header == decoded
  let assert True = chunk == decoded_chunk
}

pub fn rejects_payload_length_mismatch_test() {
  let bad_header =
    bit_array.from_string(
      "{\"type\":\"file.chunk\",\"transfer_id\":\"transfer_1\",\"sequence\":0,\"offset\":0,\"byte_length\":10,\"final\":false}",
    )
  let frame =
    bit_array.concat([
      <<bit_array.byte_size(bad_header):size(32)>>,
      bad_header,
      bit_array.from_string("tiny"),
    ])

  let assert Error(file_frame.InvalidPayloadLength) =
    file_frame.decode_chunk_frame(frame)
}
