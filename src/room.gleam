import file_store
import gleam/dict
import gleam/erlang/process
import gleam/list
import gleam/option
import gleam/otp/actor
import gleam/result
import gleam/string
import ids
import message_store
import shared/protocol as shared_protocol

const message_store_timeout_ms = 1000

const spool_dir = "priv/spool"

pub type ClientMessage {
  SendPeerList(peers: List(shared_protocol.Peer))
  SendPeerJoined(peer: shared_protocol.Peer)
  SendPeerUpdated(peer: shared_protocol.Peer)
  SendPeerLeft(device_id: String)
  SendTextMessage(message: shared_protocol.TextMessage)
  SendMessageHistory(messages: List(shared_protocol.TextMessage))
  SendFileOffered(offer: shared_protocol.FileOffer)
  SendFileDeclined(transfer_id: String)
  SendFileCancelled(transfer_id: String, reason: String)
  SendTransferAccepted(transfer_id: String, upload_url: String)
  SendTransferProgress(
    transfer_id: String,
    phase: String,
    bytes: Int,
    total: Int,
  )
  SendTransferReady(transfer_id: String, download_url: option.Option(String))
  SendTransferDone(transfer_id: String)
  SendTransferFailed(transfer_id: String, reason: String)
  SendError(code: String, message: String)
  SessionReplaced
}

pub type Message {
  Join(
    device_id: String,
    display_name: String,
    device_kind: String,
    client: process.Subject(ClientMessage),
  )
  UpdatePeer(
    from: String,
    patch: shared_protocol.PeerMetadataPatch,
    client: process.Subject(ClientMessage),
  )
  Leave(device_id: String, client: process.Subject(ClientMessage))
  SendText(
    from: String,
    to: String,
    body: String,
    client: process.Subject(ClientMessage),
  )
  OfferFile(
    from: String,
    to: String,
    client_offer_id: String,
    name: String,
    size: Int,
    mime_type: String,
    client: process.Subject(ClientMessage),
  )
  AcceptFile(
    from: String,
    transfer_id: String,
    client: process.Subject(ClientMessage),
  )
  DeclineFile(
    from: String,
    transfer_id: String,
    client: process.Subject(ClientMessage),
  )
  CancelFile(
    from: String,
    transfer_id: String,
    client: process.Subject(ClientMessage),
  )
  BeginUpload(
    reply: process.Subject(Result(UploadLease, HttpTransferError)),
    transfer_id: String,
    token: String,
  )
  UploadProgress(
    reply: process.Subject(Result(Nil, HttpTransferError)),
    transfer_id: String,
    token: String,
    bytes: Int,
  )
  CompleteUpload(
    reply: process.Subject(Result(Nil, HttpTransferError)),
    transfer_id: String,
    token: String,
    bytes: Int,
  )
  FailUpload(transfer_id: String, token: String, reason: String)
  BeginDownload(
    reply: process.Subject(Result(DownloadLease, HttpTransferError)),
    transfer_id: String,
    token: String,
  )
  CompleteDownload(transfer_id: String)
}

pub type UploadLease {
  UploadLease(transfer_id: String, size: Int)
}

pub type DownloadLease {
  DownloadLease(transfer_id: String, name: String, size: Int)
}

pub type HttpTransferError {
  HttpTransferNotFound
  HttpTransferInvalidToken
  HttpTransferInvalidState
  HttpTransferSizeMismatch
  HttpTransferCancelled
}

type TransferTokens {
  TransferTokens(upload: String, download: String)
}

type TransferStatus {
  Pending
  Accepted(tokens: TransferTokens)
  Uploading(tokens: TransferTokens, uploaded_bytes: Int)
  Ready(tokens: TransferTokens)
}

type Transfer {
  Transfer(offer: shared_protocol.FileOffer, status: TransferStatus)
}

type PeerSession {
  PeerSession(
    peer: shared_protocol.Peer,
    client: process.Subject(ClientMessage),
  )
}

type SendTextRoute {
  SendTextRoute(sender: PeerSession, receiver: PeerSession)
}

type OfferFileRoute {
  OfferFileRoute(sender: PeerSession, receiver: PeerSession)
}

type AcceptFileRoute {
  AcceptFileRoute(
    transfer: Transfer,
    sender: PeerSession,
    receiver: PeerSession,
  )
}

type SendTextRejection {
  SendTextRejection(
    client: process.Subject(ClientMessage),
    code: String,
    message: String,
  )
}

type State {
  State(
    peers: dict.Dict(String, PeerSession),
    transfers: dict.Dict(String, Transfer),
    active_transfer: option.Option(String),
    message_store: process.Subject(message_store.Message),
  )
}

pub type StartError {
  StoreStartFailed(message_store.StartError)
  RoomStartFailed(actor.StartError)
}

pub fn start() -> Result(process.Subject(Message), StartError) {
  case message_store.start(":memory:") {
    Ok(store) ->
      start_with_store(store)
      |> result.map_error(RoomStartFailed)
    Error(error) -> Error(StoreStartFailed(error))
  }
}

pub fn start_with_store(
  store: process.Subject(message_store.Message),
) -> Result(process.Subject(Message), actor.StartError) {
  case
    actor.new(State(
      peers: dict.new(),
      transfers: dict.new(),
      active_transfer: option.None,
      message_store: store,
    ))
    |> actor.on_message(handle_message)
    |> actor.start
  {
    Ok(started) -> Ok(started.data)
    Error(error) -> Error(error)
  }
}

fn handle_message(
  state: State,
  message: Message,
) -> actor.Next(State, Message) {
  case message {
    Join(device_id:, display_name:, device_kind:, client:) ->
      join(state, device_id, display_name, device_kind, client)
    UpdatePeer(from:, patch:, client:) ->
      update_peer(state, from, patch, client)
    Leave(device_id:, client:) -> leave(state, device_id, client)
    SendText(from:, to:, body:, client:) ->
      send_text(state, from, to, body, client)
    OfferFile(from:, to:, client_offer_id:, name:, size:, mime_type:, client:) ->
      offer_file(
        state,
        from,
        to,
        client_offer_id,
        name,
        size,
        mime_type,
        client,
      )
    AcceptFile(from:, transfer_id:, client:) ->
      accept_file(state, from, transfer_id, client)
    DeclineFile(from:, transfer_id:, client:) ->
      decline_file(state, from, transfer_id, client)
    CancelFile(from:, transfer_id:, client:) ->
      cancel_file(state, from, transfer_id, client)
    BeginUpload(reply:, transfer_id:, token:) ->
      begin_upload(state, reply, transfer_id, token)
    UploadProgress(reply:, transfer_id:, token:, bytes:) ->
      upload_progress(state, reply, transfer_id, token, bytes)
    CompleteUpload(reply:, transfer_id:, token:, bytes:) ->
      complete_upload(state, reply, transfer_id, token, bytes)
    FailUpload(transfer_id:, token:, reason:) ->
      fail_upload(state, transfer_id, token, reason)
    BeginDownload(reply:, transfer_id:, token:) ->
      begin_download(state, reply, transfer_id, token)
    CompleteDownload(transfer_id:) -> complete_download(state, transfer_id)
  }
}

fn join(
  state: State,
  device_id: String,
  display_name: String,
  device_kind: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  let peer =
    shared_protocol.Peer(
      id: device_id,
      display_name: display_name,
      device_kind: device_kind,
      os: "unknown",
      browser: "unknown",
      model: option.None,
    )
  let session = PeerSession(peer: peer, client: client)

  case dict.get(state.peers, device_id) {
    Error(_) -> {
      let peers =
        dict.insert(into: state.peers, for: device_id, insert: session)
      let new_state = State(..state, peers: peers)
      send_join_snapshot(new_state, client, device_id)
      broadcast_joined(state.peers, peer)
      actor.continue(new_state)
    }
    Ok(stored) -> {
      let peers =
        dict.insert(into: state.peers, for: device_id, insert: session)
      let new_state = State(..state, peers: peers)

      case stored.client == client {
        True -> Nil
        False -> process.send(stored.client, SessionReplaced)
      }

      send_join_snapshot(new_state, client, device_id)
      broadcast_joined_to_others(peers, device_id, peer)
      actor.continue(new_state)
    }
  }
}

fn update_peer(
  state: State,
  from: String,
  patch: shared_protocol.PeerMetadataPatch,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  case find_sender(state.peers, from, client) {
    Ok(session) ->
      case session.client == client {
        False ->
          reject_send_text(
            state,
            SendTextRejection(
              client: client,
              code: "not_joined",
              message: "Send peer.hello before updating presence.",
            ),
          )
        True -> {
          let peer = apply_peer_patch(session.peer, patch)
          let peers =
            dict.insert(
              into: state.peers,
              for: from,
              insert: PeerSession(peer: peer, client: client),
            )
          let new_state = State(..state, peers: peers)

          broadcast_updated_to_others(peers, from, peer)
          actor.continue(new_state)
        }
      }
    Error(rejection) -> reject_send_text(state, rejection)
  }
}

fn apply_peer_patch(
  peer: shared_protocol.Peer,
  patch: shared_protocol.PeerMetadataPatch,
) -> shared_protocol.Peer {
  let display_name = case patch.display_name {
    option.Some(value) -> value
    option.None -> peer.display_name
  }
  let device_kind = case patch.device_kind {
    option.Some(value) -> value
    option.None -> peer.device_kind
  }
  let os = case patch.os {
    option.Some(value) -> value
    option.None -> peer.os
  }
  let browser = case patch.browser {
    option.Some(value) -> value
    option.None -> peer.browser
  }
  let model = case patch.model {
    option.Some(value) -> option.Some(value)
    option.None -> peer.model
  }

  shared_protocol.Peer(
    id: peer.id,
    display_name: display_name,
    device_kind: device_kind,
    os: os,
    browser: browser,
    model: model,
  )
}

fn send_join_snapshot(
  state: State,
  client: process.Subject(ClientMessage),
  device_id: String,
) -> Nil {
  process.send(client, SendPeerList(sorted_peers(state.peers)))

  case
    message_store.load_device_message_history(
      state.message_store,
      device_id: device_id,
      timeout: message_store_timeout_ms,
    )
  {
    Ok(messages) -> process.send(client, SendMessageHistory(messages))
    Error(_) ->
      process.send(
        client,
        SendError(
          code: "history_load_failed",
          message: "Message history could not be loaded.",
        ),
      )
  }
}

fn leave(
  state: State,
  device_id: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  case dict.get(state.peers, device_id) {
    Error(_) -> actor.continue(state)
    Ok(stored) ->
      case stored.client == client {
        False -> actor.continue(state)
        True -> {
          let state = cancel_transfers_for_device(state, device_id)
          let peers = dict.delete(from: state.peers, delete: device_id)
          broadcast_left(peers, device_id)
          actor.continue(State(..state, peers: peers))
        }
      }
  }
}

fn send_text(
  state: State,
  from: String,
  to: String,
  body: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  case send_text_route(state, from, to, client) {
    Ok(SendTextRoute(sender:, receiver:)) ->
      persist_and_deliver_text(state, sender, receiver, from, to, body)
    Error(rejection) -> reject_send_text(state, rejection)
  }
}

fn send_text_route(
  state: State,
  from: String,
  to: String,
  client: process.Subject(ClientMessage),
) -> Result(SendTextRoute, SendTextRejection) {
  use Nil <- result.try(ensure_not_self(from, to, client))
  use sender <- result.try(find_sender(state.peers, from, client))
  use receiver <- result.try(find_receiver(state.peers, to, sender.client))

  Ok(SendTextRoute(sender: sender, receiver: receiver))
}

fn ensure_not_self(
  from: String,
  to: String,
  client: process.Subject(ClientMessage),
) -> Result(Nil, SendTextRejection) {
  case from == to {
    True ->
      Error(SendTextRejection(
        client: client,
        code: "invalid_recipient",
        message: "You cannot send a message to yourself.",
      ))
    False -> Ok(Nil)
  }
}

fn find_sender(
  peers: dict.Dict(String, PeerSession),
  from: String,
  client: process.Subject(ClientMessage),
) -> Result(PeerSession, SendTextRejection) {
  case dict.get(peers, from) {
    Ok(sender) -> Ok(sender)
    Error(_) ->
      Error(SendTextRejection(
        client: client,
        code: "not_joined",
        message: "Send peer.hello before sending messages.",
      ))
  }
}

fn find_receiver(
  peers: dict.Dict(String, PeerSession),
  to: String,
  sender: process.Subject(ClientMessage),
) -> Result(PeerSession, SendTextRejection) {
  case dict.get(peers, to) {
    Ok(receiver) -> Ok(receiver)
    Error(_) ->
      Error(SendTextRejection(
        client: sender,
        code: "peer_offline",
        message: "The selected peer is no longer online.",
      ))
  }
}

fn persist_and_deliver_text(
  state: State,
  sender: PeerSession,
  receiver: PeerSession,
  from: String,
  to: String,
  body: String,
) -> actor.Next(State, Message) {
  case
    message_store.persist_text_message(
      state.message_store,
      from: from,
      to: to,
      body: body,
      timeout: message_store_timeout_ms,
    )
  {
    Ok(message) -> {
      process.send(sender.client, SendTextMessage(message))
      process.send(receiver.client, SendTextMessage(message))
      actor.continue(state)
    }
    Error(_) ->
      reject_send_text(
        state,
        SendTextRejection(
          client: sender.client,
          code: "message_persist_failed",
          message: "Message could not be saved.",
        ),
      )
  }
}

fn offer_file(
  state: State,
  from: String,
  to: String,
  client_offer_id: String,
  name: String,
  size: Int,
  mime_type: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  let transfer_id = ids.transfer_id()
  case offer_file_route(state, from, to, transfer_id, client) {
    Ok(OfferFileRoute(receiver:, sender:)) -> {
      let offer =
        shared_protocol.FileOffer(
          transfer_id: transfer_id,
          client_offer_id: option.Some(client_offer_id),
          from: from,
          to: to,
          name: name,
          size: size,
          mime_type: mime_type,
        )
      let transfers =
        dict.insert(
          into: state.transfers,
          for: transfer_id,
          insert: Transfer(offer: offer, status: Pending),
        )

      process.send(receiver.client, SendFileOffered(offer))
      process.send(sender.client, SendFileOffered(offer))
      actor.continue(State(..state, transfers: transfers))
    }
    Error(rejection) -> reject_send_text(state, rejection)
  }
}

fn accept_file(
  state: State,
  from: String,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  case accept_file_route(state, from, transfer_id, client) {
    Ok(AcceptFileRoute(transfer:, sender:, receiver:)) -> {
      let tokens =
        TransferTokens(
          upload: ids.transfer_token(),
          download: ids.transfer_token(),
        )
      let transfers =
        dict.insert(
          into: state.transfers,
          for: transfer_id,
          insert: Transfer(..transfer, status: Accepted(tokens: tokens)),
        )
      let upload_url = upload_url(transfer_id, tokens.upload)

      process.send(sender.client, SendTransferAccepted(transfer_id, upload_url))
      process.send(
        receiver.client,
        SendTransferProgress(
          transfer_id: transfer_id,
          phase: "uploading",
          bytes: 0,
          total: transfer.offer.size,
        ),
      )
      actor.continue(
        State(
          ..state,
          transfers: transfers,
          active_transfer: option.Some(transfer_id),
        ),
      )
    }
    Error(rejection) -> reject_send_text(state, rejection)
  }
}

fn offer_file_route(
  state: State,
  from: String,
  to: String,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> Result(OfferFileRoute, SendTextRejection) {
  use sender <- result.try(find_sender(state.peers, from, client))
  use receiver <- result.try(find_receiver(state.peers, to, sender.client))
  use Nil <- result.try(ensure_not_self(from, to, client))
  use Nil <- result.try(ensure_transfer_id_available(state, transfer_id, client))

  Ok(OfferFileRoute(sender: sender, receiver: receiver))
}

fn accept_file_route(
  state: State,
  from: String,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> Result(AcceptFileRoute, SendTextRejection) {
  use file_transfer <- result.try(transfer_for_receiver(
    state,
    from,
    transfer_id,
    client,
  ))
  use Nil <- result.try(ensure_no_active_transfer(state, client))
  use sender <- result.try(find_receiver(
    state.peers,
    file_transfer.offer.from,
    client,
  ))
  use receiver <- result.try(find_sender(state.peers, from, client))

  Ok(AcceptFileRoute(
    transfer: file_transfer,
    sender: sender,
    receiver: receiver,
  ))
}

fn decline_file(
  state: State,
  from: String,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  case transfer_for_receiver(state, from, transfer_id, client) {
    Ok(file_transfer) -> {
      let state = remove_transfer(state, transfer_id)
      notify_transfer_participants(
        state,
        file_transfer.offer,
        SendFileDeclined(transfer_id),
      )
      actor.continue(state)
    }
    Error(rejection) -> reject_send_text(state, rejection)
  }
}

fn cancel_file(
  state: State,
  from: String,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  case transfer_for_participant(state, from, transfer_id, client) {
    Ok(file_transfer) -> {
      let state = remove_transfer(state, transfer_id)
      file_store.remove_transfer_files(spool_dir, transfer_id)
      notify_transfer_participants(
        state,
        file_transfer.offer,
        SendFileCancelled(transfer_id, "Transfer cancelled."),
      )
      actor.continue(state)
    }
    Error(rejection) -> reject_send_text(state, rejection)
  }
}

fn begin_upload(
  state: State,
  reply: process.Subject(Result(UploadLease, HttpTransferError)),
  transfer_id: String,
  token: String,
) -> actor.Next(State, Message) {
  let result = {
    use #(transfer, tokens) <- result.try(upload_tokens(
      state,
      transfer_id,
      token,
    ))

    let lease = UploadLease(transfer_id: transfer_id, size: transfer.offer.size)
    let transfers =
      dict.insert(
        into: state.transfers,
        for: transfer_id,
        insert: Transfer(
          ..transfer,
          status: Uploading(tokens: tokens, uploaded_bytes: 0),
        ),
      )

    Ok(#(lease, State(..state, transfers: transfers)))
  }

  reply_with_state(state, reply, result)
}

fn upload_progress(
  state: State,
  reply: process.Subject(Result(Nil, HttpTransferError)),
  transfer_id: String,
  token: String,
  bytes: Int,
) -> actor.Next(State, Message) {
  let result = {
    use #(transfer, tokens) <- result.try(upload_tokens(
      state,
      transfer_id,
      token,
    ))

    notify_transfer_participants(
      state,
      transfer.offer,
      SendTransferProgress(
        transfer_id: transfer_id,
        phase: "uploading",
        bytes: bytes,
        total: transfer.offer.size,
      ),
    )

    let transfers =
      dict.insert(
        into: state.transfers,
        for: transfer_id,
        insert: Transfer(
          ..transfer,
          status: Uploading(tokens: tokens, uploaded_bytes: bytes),
        ),
      )

    Ok(#(Nil, State(..state, transfers: transfers)))
  }

  reply_with_state(state, reply, result)
}

fn reply_with_state(
  state: State,
  reply: process.Subject(Result(value, HttpTransferError)),
  result: Result(#(value, State), HttpTransferError),
) -> actor.Next(State, Message) {
  case result {
    Ok(#(value, state)) -> {
      process.send(reply, Ok(value))
      actor.continue(state)
    }
    Error(error) -> {
      process.send(reply, Error(error))
      actor.continue(state)
    }
  }
}

fn reply_and_continue(
  state: State,
  reply: process.Subject(Result(value, HttpTransferError)),
  result: Result(value, HttpTransferError),
) -> actor.Next(State, Message) {
  process.send(reply, result)
  actor.continue(state)
}

fn complete_upload(
  state: State,
  reply: process.Subject(Result(Nil, HttpTransferError)),
  transfer_id: String,
  token: String,
  bytes: Int,
) -> actor.Next(State, Message) {
  case upload_tokens(state, transfer_id, token) {
    Ok(#(transfer, tokens)) -> {
      case bytes == transfer.offer.size {
        False -> {
          notify_transfer_participants(
            state,
            transfer.offer,
            SendTransferFailed(transfer_id, "upload_size_mismatch"),
          )
          let state = remove_transfer(state, transfer_id)
          process.send(reply, Error(HttpTransferSizeMismatch))
          actor.continue(state)
        }
        True -> {
          let transfers =
            dict.insert(
              into: state.transfers,
              for: transfer_id,
              insert: Transfer(..transfer, status: Ready(tokens: tokens)),
            )
          notify_transfer_participants(
            state,
            transfer.offer,
            SendTransferProgress(
              transfer_id: transfer_id,
              phase: "uploading",
              bytes: bytes,
              total: transfer.offer.size,
            ),
          )
          notify_ready(state, transfer.offer, transfer_id, tokens.download)
          process.send(reply, Ok(Nil))
          actor.continue(State(..state, transfers: transfers))
        }
      }
    }
    Error(error) -> {
      process.send(reply, Error(error))
      actor.continue(state)
    }
  }
}

fn begin_download(
  state: State,
  reply: process.Subject(Result(DownloadLease, HttpTransferError)),
  transfer_id: String,
  token: String,
) -> actor.Next(State, Message) {
  let result =
    ready_transfer(state, transfer_id, token)
    |> result.map(fn(transfer) {
      DownloadLease(
        transfer_id: transfer_id,
        name: transfer.offer.name,
        size: transfer.offer.size,
      )
    })

  reply_and_continue(state, reply, result)
}

fn fail_upload(
  state: State,
  transfer_id: String,
  token: String,
  reason: String,
) -> actor.Next(State, Message) {
  case upload_tokens(state, transfer_id, token) {
    Ok(#(transfer, _tokens)) -> {
      let state = remove_transfer(state, transfer_id)
      notify_transfer_participants(
        state,
        transfer.offer,
        SendTransferFailed(transfer_id, reason),
      )
      actor.continue(state)
    }
    Error(_) -> actor.continue(state)
  }
}

fn complete_download(
  state: State,
  transfer_id: String,
) -> actor.Next(State, Message) {
  case dict.get(state.transfers, transfer_id) {
    Ok(transfer) -> {
      let state = remove_transfer(state, transfer_id)
      notify_transfer_participants(
        state,
        transfer.offer,
        SendTransferDone(transfer_id),
      )
      file_store.remove_transfer_files(spool_dir, transfer_id)
      actor.continue(state)
    }
    Error(_) -> actor.continue(state)
  }
}

fn ensure_transfer_id_available(
  state: State,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> Result(Nil, SendTextRejection) {
  case dict.get(state.transfers, transfer_id) {
    Ok(_) ->
      Error(SendTextRejection(
        client: client,
        code: "transfer_exists",
        message: "That transfer already exists.",
      ))
    Error(_) -> Ok(Nil)
  }
}

fn ensure_no_active_transfer(
  state: State,
  client: process.Subject(ClientMessage),
) -> Result(Nil, SendTextRejection) {
  case state.active_transfer {
    option.None -> Ok(Nil)
    option.Some(_) ->
      Error(SendTextRejection(
        client: client,
        code: "transfer_busy",
        message: "Another file transfer is already active.",
      ))
  }
}

fn transfer_for_receiver(
  state: State,
  from: String,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> Result(Transfer, SendTextRejection) {
  use file_transfer <- result.try(find_transfer(state, transfer_id, client))
  use receiver <- result.try(find_sender(state.peers, from, client))

  case file_transfer.offer.to == from && receiver.client == client {
    True -> Ok(file_transfer)
    False ->
      Error(SendTextRejection(
        client: client,
        code: "invalid_transfer_participant",
        message: "That file transfer is not addressed to this device.",
      ))
  }
}

fn transfer_for_participant(
  state: State,
  from: String,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> Result(Transfer, SendTextRejection) {
  use file_transfer <- result.try(find_transfer(state, transfer_id, client))
  use session <- result.try(find_sender(state.peers, from, client))

  case
    session.client == client
    && { file_transfer.offer.from == from || file_transfer.offer.to == from }
  {
    True -> Ok(file_transfer)
    False ->
      Error(SendTextRejection(
        client: client,
        code: "invalid_transfer_participant",
        message: "That file transfer does not belong to this device.",
      ))
  }
}

fn find_transfer(
  state: State,
  transfer_id: String,
  client: process.Subject(ClientMessage),
) -> Result(Transfer, SendTextRejection) {
  case dict.get(state.transfers, transfer_id) {
    Ok(transfer) -> Ok(transfer)
    Error(_) ->
      Error(SendTextRejection(
        client: client,
        code: "transfer_not_found",
        message: "That file transfer is no longer available.",
      ))
  }
}

fn upload_tokens(
  state: State,
  transfer_id: String,
  token: String,
) -> Result(#(Transfer, TransferTokens), HttpTransferError) {
  use transfer <- result.try(http_transfer(state, transfer_id))

  case transfer.status {
    Accepted(tokens) | Uploading(tokens:, uploaded_bytes: _) -> {
      use Nil <- result.try(ensure_transfer_token(tokens.upload, token))
      Ok(#(transfer, tokens))
    }
    Pending -> Error(HttpTransferInvalidState)
    Ready(_) -> Error(HttpTransferInvalidState)
  }
}

fn ready_transfer(
  state: State,
  transfer_id: String,
  token: String,
) -> Result(Transfer, HttpTransferError) {
  use transfer <- result.try(http_transfer(state, transfer_id))

  case transfer.status {
    Ready(tokens) -> {
      use Nil <- result.try(ensure_transfer_token(tokens.download, token))
      Ok(transfer)
    }
    Pending -> Error(HttpTransferInvalidState)
    Accepted(_) -> Error(HttpTransferInvalidState)
    Uploading(_, _) -> Error(HttpTransferInvalidState)
  }
}

fn ensure_transfer_token(
  expected: String,
  actual: String,
) -> Result(Nil, HttpTransferError) {
  case expected == actual {
    True -> Ok(Nil)
    False -> Error(HttpTransferInvalidToken)
  }
}

fn http_transfer(
  state: State,
  transfer_id: String,
) -> Result(Transfer, HttpTransferError) {
  case dict.get(state.transfers, transfer_id) {
    Ok(transfer) -> Ok(transfer)
    Error(_) -> Error(HttpTransferNotFound)
  }
}

fn notify_ready(
  state: State,
  offer: shared_protocol.FileOffer,
  transfer_id: String,
  download_token: String,
) -> Nil {
  send_to_peer(
    state.peers,
    offer.from,
    SendTransferReady(transfer_id: transfer_id, download_url: option.None),
  )
  send_to_peer(
    state.peers,
    offer.to,
    SendTransferReady(
      transfer_id: transfer_id,
      download_url: option.Some(download_url(transfer_id, download_token)),
    ),
  )
}

fn upload_url(transfer_id: String, token: String) -> String {
  "/api/transfers/" <> transfer_id <> "/upload?token=" <> token
}

fn download_url(transfer_id: String, token: String) -> String {
  "/api/transfers/" <> transfer_id <> "/download?token=" <> token
}

fn remove_transfer(state: State, transfer_id: String) -> State {
  let active_transfer = case state.active_transfer {
    option.Some(active_id) if active_id == transfer_id -> option.None
    other -> other
  }

  State(
    ..state,
    transfers: dict.delete(from: state.transfers, delete: transfer_id),
    active_transfer: active_transfer,
  )
}

fn cancel_transfers_for_device(state: State, device_id: String) -> State {
  state.transfers
  |> dict.values
  |> list.filter(fn(file_transfer) {
    file_transfer.offer.from == device_id || file_transfer.offer.to == device_id
  })
  |> list.fold(state, fn(state, file_transfer) {
    let state = remove_transfer(state, file_transfer.offer.transfer_id)
    file_store.remove_transfer_files(spool_dir, file_transfer.offer.transfer_id)
    notify_transfer_participants(
      state,
      file_transfer.offer,
      SendFileCancelled(file_transfer.offer.transfer_id, "Peer disconnected."),
    )
    state
  })
}

fn notify_transfer_participants(
  state: State,
  offer: shared_protocol.FileOffer,
  message: ClientMessage,
) -> Nil {
  send_to_peer(state.peers, offer.from, message)
  send_to_peer(state.peers, offer.to, message)
}

fn send_to_peer(
  peers: dict.Dict(String, PeerSession),
  device_id: String,
  message: ClientMessage,
) -> Nil {
  case dict.get(peers, device_id) {
    Ok(session) -> process.send(session.client, message)
    Error(_) -> Nil
  }
}

fn reject_send_text(
  state: State,
  rejection: SendTextRejection,
) -> actor.Next(State, Message) {
  let SendTextRejection(client:, code:, message:) = rejection
  process.send(client, SendError(code: code, message: message))
  actor.continue(state)
}

fn sorted_peers(
  peers: dict.Dict(String, PeerSession),
) -> List(shared_protocol.Peer) {
  peers
  |> dict.values
  |> list.map(fn(session) { session.peer })
  |> list.sort(fn(a, b) { string.compare(a.id, b.id) })
}

fn broadcast_joined(
  peers: dict.Dict(String, PeerSession),
  peer: shared_protocol.Peer,
) -> Nil {
  peers
  |> dict.values
  |> list.each(fn(session) {
    process.send(session.client, SendPeerJoined(peer))
  })
}

fn broadcast_joined_to_others(
  peers: dict.Dict(String, PeerSession),
  device_id: String,
  peer: shared_protocol.Peer,
) -> Nil {
  broadcast_to_others(peers, device_id, SendPeerJoined(peer))
}

fn broadcast_updated_to_others(
  peers: dict.Dict(String, PeerSession),
  device_id: String,
  peer: shared_protocol.Peer,
) -> Nil {
  broadcast_to_others(peers, device_id, SendPeerUpdated(peer))
}

fn broadcast_to_others(
  peers: dict.Dict(String, PeerSession),
  device_id: String,
  message: ClientMessage,
) -> Nil {
  peers
  |> dict.values
  |> list.each(fn(session) {
    case session.peer.id == device_id {
      True -> Nil
      False -> process.send(session.client, message)
    }
  })
}

fn broadcast_left(
  peers: dict.Dict(String, PeerSession),
  device_id: String,
) -> Nil {
  peers
  |> dict.values
  |> list.each(fn(session) {
    process.send(session.client, SendPeerLeft(device_id))
  })
}
