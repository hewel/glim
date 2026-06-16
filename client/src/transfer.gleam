import gleam/list
import gleam/option
import shared/protocol as shared_protocol

pub type Direction {
  Sending
  Receiving
}

pub type Status {
  Offered
  Transferring
  Ready
  Completed
  Failed
  Cancelled
  Declined
  Unsupported
}

pub type FileSelection {
  FileSelection(
    client_offer_id: String,
    name: String,
    size: Int,
    mime_type: String,
  )
}

pub type LocalFile {
  LocalFile(client_offer_id: String)
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
    download_url: option.Option(String),
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
      transfer_id: selection.client_offer_id,
      peer_id: peer_id,
      peer_name: peer_name,
      name: selection.name,
      mime_type: selection.mime_type,
      size: selection.size,
      transferred: 0,
      download_url: option.None,
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
    False -> #(
      Unsupported,
      "HTTP relay download is not supported in this browser",
    )
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
      download_url: option.None,
      direction: Receiving,
      status: status,
      notice: notice,
    ),
  )
}

pub fn local_file(selection: FileSelection) -> LocalFile {
  LocalFile(client_offer_id: selection.client_offer_id)
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
  transfer_id: String,
  bytes: Int,
) -> List(Item) {
  items
  |> list.map(fn(item) {
    case item.transfer_id == transfer_id {
      True ->
        Item(
          ..item,
          transferred: bytes,
          status: Transferring,
          notice: "Uploading",
        )
      False -> item
    }
  })
}

pub fn mark_ready(
  items: List(Item),
  transfer_id: String,
  download_url: option.Option(String),
) -> List(Item) {
  items
  |> list.map(fn(item) {
    case item.transfer_id == transfer_id {
      True ->
        Item(
          ..item,
          transferred: item.size,
          download_url: download_url,
          status: Ready,
          notice: "Ready to download",
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
      Transferring -> Item(..item, status: Failed, notice: "Connection lost.")
      Ready -> Item(..item, status: Failed, notice: "Connection lost.")
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
      Transferring -> True
      Ready -> True
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
      Transferring -> True
      Ready -> True
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
