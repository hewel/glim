import file_streams/file_stream
import gleam/bit_array
import gleam/result
import mist
import simplifile

pub type UploadError {
  OpenFailed
  ReadFailed
  WriteFailed
  CloseFailed
  TooLarge
  Cancelled
}

pub fn transfer_part_path(spool_dir: String, transfer_id: String) -> String {
  spool_dir <> "/" <> transfer_id <> ".part"
}

pub fn transfer_blob_path(spool_dir: String, transfer_id: String) -> String {
  spool_dir <> "/" <> transfer_id <> ".blob"
}

pub fn ensure_spool_dir(
  spool_dir: String,
) -> Result(Nil, simplifile.FileError) {
  simplifile.create_directory_all(spool_dir)
}

pub fn remove_transfer_files(spool_dir: String, transfer_id: String) -> Nil {
  let _ = simplifile.delete_file(at: transfer_part_path(spool_dir, transfer_id))
  let _ = simplifile.delete_file(at: transfer_blob_path(spool_dir, transfer_id))
  Nil
}

pub fn promote_upload(
  spool_dir: String,
  transfer_id: String,
) -> Result(Nil, simplifile.FileError) {
  simplifile.rename(
    at: transfer_part_path(spool_dir, transfer_id),
    to: transfer_blob_path(spool_dir, transfer_id),
  )
}

pub fn stream_upload(
  consumer: fn(Int) -> Result(mist.Chunk, mist.ReadError),
  to path: String,
  max_bytes max_bytes: Int,
  on_progress on_progress: fn(Int) -> Result(Nil, Nil),
) -> Result(Int, UploadError) {
  use stream <- result.try(
    file_stream.open_write(path)
    |> result.map_error(fn(_) { OpenFailed }),
  )

  case write_stream(consumer, stream, 0, max_bytes, on_progress) {
    Ok(bytes) ->
      file_stream.close(stream)
      |> result.map(fn(_) { bytes })
      |> result.map_error(fn(_) { CloseFailed })
    Error(error) -> {
      let _ = file_stream.close(stream)
      Error(error)
    }
  }
}

fn write_stream(
  consumer: fn(Int) -> Result(mist.Chunk, mist.ReadError),
  stream: file_stream.FileStream,
  written: Int,
  max_bytes: Int,
  on_progress: fn(Int) -> Result(Nil, Nil),
) -> Result(Int, UploadError) {
  case consumer(64 * 1024) {
    Error(_) -> Error(ReadFailed)
    Ok(mist.Done) -> Ok(written)
    Ok(mist.Chunk(data:, consume:)) -> {
      let next_written = written + bit_array.byte_size(data)
      case next_written > max_bytes {
        True -> Error(TooLarge)
        False -> {
          use Nil <- result.try(
            file_stream.write_bytes(stream, data)
            |> result.map_error(fn(_) { WriteFailed }),
          )
          use Nil <- result.try(
            on_progress(next_written)
            |> result.map_error(fn(_) { Cancelled }),
          )
          write_stream(consume, stream, next_written, max_bytes, on_progress)
        }
      }
    }
  }
}
