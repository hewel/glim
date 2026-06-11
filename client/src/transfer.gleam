import gleam/list
import gleam/option
import shared/protocol as shared_protocol

pub type Direction {
  Sending
  Receiving
}

pub type Status {
  Offered
  AwaitingSave
  Transferring
  Completed
  Failed
  Cancelled
  Declined
  Unsupported
}

pub type FileSelection {
  FileSelection(
    transfer_id: String,
    file_id: String,
    name: String,
    size: Int,
    mime_type: String,
  )
}

pub type LocalFile {
  LocalFile(file_id: String, size: Int, next_sequence: Int, next_offset: Int)
}

pub type Item {
  Item(
    transfer_id: String,
    peer_id: String,
    peer_name: String,
    name: String,
    mime_type: String,
    size: Int,
    transferred: Int,
    direction: Direction,
    status: Status,
    notice: String,
  )
}

pub fn add_outgoing(
  items: List(Item),
  peer_id: String,
  peer_name: String,
  selection: FileSelection,
) -> List(Item) {
  append_or_replace(
    items,
    Item(
      transfer_id: selection.transfer_id,
      peer_id: peer_id,
      peer_name: peer_name,
      name: selection.name,
      mime_type: selection.mime_type,
      size: selection.size,
      transferred: 0,
      direction: Sending,
      status: Offered,
      notice: "Waiting for acceptance",
    ),
  )
}

pub fn add_incoming(
  items: List(Item),
  offer: shared_protocol.FileOffer,
  peer_name: String,
  supported: Bool,
) -> List(Item) {
  let #(status, notice) = case supported {
    True -> #(Offered, "Waiting for your response")
    False -> #(Unsupported, "Stream-to-save is not supported in this browser")
  }

  append_or_replace(
    items,
    Item(
      transfer_id: offer.transfer_id,
      peer_id: offer.from,
      peer_name: peer_name,
      name: offer.name,
      mime_type: offer.mime_type,
      size: offer.size,
      transferred: 0,
      direction: Receiving,
      status: status,
      notice: notice,
    ),
  )
}

pub fn local_file(selection: FileSelection) -> LocalFile {
  LocalFile(
    file_id: selection.file_id,
    size: selection.size,
    next_sequence: 0,
    next_offset: 0,
  )
}

pub fn update_local_file_after_ack(
  file: LocalFile,
  ack: shared_protocol.FileChunkAck,
) -> LocalFile {
  LocalFile(
    ..file,
    next_sequence: ack.sequence + 1,
    next_offset: ack.offset + ack.byte_length,
  )
}

pub fn mark_status(
  items: List(Item),
  transfer_id: String,
  status: Status,
  notice: String,
) -> List(Item) {
  items
  |> list.map(fn(item) {
    case item.transfer_id == transfer_id {
      True -> Item(..item, status: status, notice: notice)
      False -> item
    }
  })
}

pub fn mark_progress(
  items: List(Item),
  ack: shared_protocol.FileChunkAck,
) -> List(Item) {
  let transferred = ack.offset + ack.byte_length
  items
  |> list.map(fn(item) {
    case item.transfer_id == ack.transfer_id {
      True ->
        Item(
          ..item,
          transferred: transferred,
          status: case ack.final {
            True -> Completed
            False -> Transferring
          },
          notice: case ack.final {
            True -> "Complete"
            False -> "Transferring"
          },
        )
      False -> item
    }
  })
}

pub fn mark_connection_lost(items: List(Item)) -> List(Item) {
  items
  |> list.map(fn(item) {
    case item.status {
      Offered -> Item(..item, status: Failed, notice: "Connection lost.")
      AwaitingSave -> Item(..item, status: Failed, notice: "Connection lost.")
      Transferring -> Item(..item, status: Failed, notice: "Connection lost.")
      Completed -> item
      Failed -> item
      Cancelled -> item
      Declined -> item
      Unsupported -> item
    }
  })
}

pub fn interrupted_transfer_ids(items: List(Item)) -> List(String) {
  items
  |> list.filter(fn(item) {
    case item.status {
      Offered -> True
      AwaitingSave -> True
      Transferring -> True
      Completed -> False
      Failed -> False
      Cancelled -> False
      Declined -> False
      Unsupported -> False
    }
  })
  |> list.map(fn(item) { item.transfer_id })
}

pub fn active_count(items: List(Item)) -> Int {
  items
  |> list.filter(fn(item) {
    case item.status {
      Offered -> True
      AwaitingSave -> True
      Transferring -> True
      Completed -> False
      Failed -> False
      Cancelled -> False
      Declined -> False
      Unsupported -> False
    }
  })
  |> list.length
}

pub fn find(items: List(Item), transfer_id: String) -> option.Option(Item) {
  case items {
    [] -> option.None
    [first, ..rest] ->
      case first.transfer_id == transfer_id {
        True -> option.Some(first)
        False -> find(rest, transfer_id)
      }
  }
}

pub fn items_for_peer(items: List(Item), peer_id: String) -> List(Item) {
  items
  |> list.filter(fn(item) { item.peer_id == peer_id })
}

fn append_or_replace(items: List(Item), item: Item) -> List(Item) {
  let without_item =
    items
    |> list.filter(fn(existing) { existing.transfer_id != item.transfer_id })

  list.append(without_item, [item])
}
