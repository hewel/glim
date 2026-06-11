import gleam/bit_array
import gleam/dynamic/decode
import gleam/json
import gleam/result
import shared/protocol as shared_protocol
import validation

pub type ChunkFrame {
  ChunkFrame(header: shared_protocol.FileChunkAck, chunk: BitArray)
}

pub type DecodeError {
  FrameTooShort
  InvalidHeaderLength
  InvalidHeader
  InvalidPayloadLength
}

pub fn encode_chunk_frame(
  header: shared_protocol.FileChunkAck,
  chunk: BitArray,
) -> BitArray {
  let header_json = encode_header(header)
  let header_bits = bit_array.from_string(header_json)

  bit_array.concat([
    <<bit_array.byte_size(header_bits):size(32)>>,
    header_bits,
    chunk,
  ])
}

pub fn decode_chunk_frame(frame: BitArray) -> Result(ChunkFrame, DecodeError) {
  case frame {
    <<header_length:size(32), rest:bits>> -> {
      use Nil <- result.try(validate_header_length(header_length, rest))
      use header_bits <- result.try(
        bit_array.slice(from: rest, at: 0, take: header_length)
        |> result.map_error(fn(_) { InvalidHeaderLength }),
      )
      use header_json <- result.try(
        bit_array.to_string(header_bits)
        |> result.map_error(fn(_) { InvalidHeader }),
      )
      use header <- result.try(decode_header(header_json))
      let chunk_length = bit_array.byte_size(rest) - header_length
      use chunk <- result.try(
        bit_array.slice(from: rest, at: header_length, take: chunk_length)
        |> result.map_error(fn(_) { InvalidPayloadLength }),
      )
      use Nil <- result.try(validate_payload_length(header, chunk))

      Ok(ChunkFrame(header: header, chunk: chunk))
    }
    _ -> Error(FrameTooShort)
  }
}

fn validate_header_length(
  header_length: Int,
  rest: BitArray,
) -> Result(Nil, DecodeError) {
  case header_length, bit_array.byte_size(rest) {
    0, _ -> Error(InvalidHeaderLength)
    length, rest_length if length > rest_length -> Error(InvalidHeaderLength)
    _, _ -> Ok(Nil)
  }
}

fn validate_payload_length(
  header: shared_protocol.FileChunkAck,
  chunk: BitArray,
) -> Result(Nil, DecodeError) {
  case header.byte_length == bit_array.byte_size(chunk) {
    True -> Ok(Nil)
    False -> Error(InvalidPayloadLength)
  }
}

fn encode_header(header: shared_protocol.FileChunkAck) -> String {
  json.object([
    #("type", json.string("file.chunk")),
    #("transfer_id", json.string(header.transfer_id)),
    #("sequence", json.int(header.sequence)),
    #("offset", json.int(header.offset)),
    #("byte_length", json.int(header.byte_length)),
    #("final", json.bool(header.final)),
  ])
  |> json.to_string
}

fn decode_header(
  input: String,
) -> Result(shared_protocol.FileChunkAck, DecodeError) {
  let decoder = {
    use event_type <- decode.field("type", decode.string)
    use transfer_id <- decode.field("transfer_id", decode.string)
    use sequence <- decode.field("sequence", decode.int)
    use offset <- decode.field("offset", decode.int)
    use byte_length <- decode.field("byte_length", decode.int)
    use final <- decode.field("final", decode.bool)
    decode.success(#(
      event_type,
      transfer_id,
      sequence,
      offset,
      byte_length,
      final,
    ))
  }

  use fields <- result.try(
    json.parse(from: input, using: decoder)
    |> result.map_error(fn(_) { InvalidHeader }),
  )
  let #(event_type, transfer_id, sequence, offset, byte_length, final) = fields
  use Nil <- result.try(validate_event_type(event_type))
  use valid_transfer_id <- result.try(
    validation.validate_transfer_id(transfer_id)
    |> result.map_error(fn(_) { InvalidHeader }),
  )
  use Nil <- result.try(validate_non_negative(sequence))
  use Nil <- result.try(validate_non_negative(offset))
  use Nil <- result.try(validate_non_negative(byte_length))

  Ok(shared_protocol.FileChunkAck(
    transfer_id: valid_transfer_id,
    sequence: sequence,
    offset: offset,
    byte_length: byte_length,
    final: final,
  ))
}

fn validate_event_type(event_type: String) -> Result(Nil, DecodeError) {
  case event_type {
    "file.chunk" -> Ok(Nil)
    _ -> Error(InvalidHeader)
  }
}

fn validate_non_negative(value: Int) -> Result(Nil, DecodeError) {
  case value < 0 {
    True -> Error(InvalidHeader)
    False -> Ok(Nil)
  }
}
