import browser
import chat
import gleam/dict
import gleam/list
import gleam/option
import gleam/result
import gleam/string
import lustre
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import shared/protocol as shared_protocol
import transfer
import ui/chat_panel
import ui/log_drawer
import ui/shell
import ui/sidebar
import ui/transfer_queue

const chunk_size = 262_144

pub fn main() -> Nil {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)
  Nil
}

type Model {
  Model(
    device_id: String,
    display_name: String,
    status: Status,
    peers: List(shared_protocol.Peer),
    known_peers: dict.Dict(String, shared_protocol.Peer),
    selected_peer_id: option.Option(String),
    message_drafts: dict.Dict(String, String),
    messages_by_peer: dict.Dict(String, List(shared_protocol.TextMessage)),
    unread_by_peer: dict.Dict(String, Int),
    transfers: List(transfer.Item),
    local_files: dict.Dict(String, transfer.LocalFile),
    pending_file_peer_id: option.Option(String),
    chat_notice: option.Option(String),
    pending_draft_clear: option.Option(chat.PendingDraftClear),
    log: List(String),
  )
}

type Status {
  Disconnected
  Connected
  ConnectionError
}

type Message {
  UserTypedDisplayName(String)
  UserClickedConnect
  UserSelectedPeer(String)
  UserDeselectedPeer
  UserTypedMessage(String)
  UserClickedSendMessage
  UserPressedMessageKey(String)
  UserClickedShareFile
  BrowserSelectedFile(transfer.FileSelection)
  BrowserFileSelectionFailed
  UserAcceptedFile(String)
  UserDeclinedFile(String)
  UserCancelledFile(String)
  BrowserReceiveReady(String)
  BrowserReceiveStartFailed(String, String)
  BrowserReceiveUnsupported(String)
  BrowserFileChunkWritten(browser.WrittenChunk)
  BrowserFileReceiveFailed(String, String)
  WebSocketBinarySendFailed(String)
  BrowserLoadedIdentity(device_id: String, display_name: String)
  WebSocketOpened
  WebSocketClosed
  WebSocketFailed
  WebSocketSendFailed
  WebSocketReceived(raw: String)
  UserClickedClearLog
}

type SendMessageRequest {
  SendMessageRequest(peer_id: String, body: String)
}

fn init(_flags: Nil) -> #(Model, Effect(Message)) {
  #(
    Model(
      device_id: "",
      display_name: "Glim Peer",
      status: Disconnected,
      peers: [],
      known_peers: dict.new(),
      selected_peer_id: option.None,
      message_drafts: dict.new(),
      messages_by_peer: dict.new(),
      unread_by_peer: dict.new(),
      transfers: [],
      local_files: dict.new(),
      pending_file_peer_id: option.None,
      chat_notice: option.None,
      pending_draft_clear: option.None,
      log: [],
    ),
    browser.load_identity(fn(identity) {
      BrowserLoadedIdentity(
        device_id: identity.device_id,
        display_name: identity.display_name,
      )
    }),
  )
}

fn update(model: Model, message: Message) -> #(Model, Effect(Message)) {
  case message {
    UserTypedDisplayName(name) -> #(
      Model(..model, display_name: name),
      effect.none(),
    )

    UserClickedConnect -> connect(model)

    UserSelectedPeer(peer_id) -> #(
      Model(
        ..model,
        selected_peer_id: option.Some(peer_id),
        unread_by_peer: chat.clear_unread(model.unread_by_peer, peer_id),
        chat_notice: option.None,
      ),
      effect.none(),
    )

    UserDeselectedPeer -> #(
      Model(..model, selected_peer_id: option.None),
      effect.none(),
    )

    UserClickedClearLog -> #(Model(..model, log: []), effect.none())

    UserTypedMessage(body) -> #(
      update_selected_draft(model, body),
      effect.none(),
    )

    UserClickedSendMessage -> send_message(model)

    UserClickedShareFile -> select_file_for_current_peer(model)

    UserPressedMessageKey(key) ->
      case key {
        "Enter" -> send_message(model)
        _ -> #(model, effect.none())
      }

    BrowserSelectedFile(selection) -> send_file_offer(model, selection)

    BrowserFileSelectionFailed ->
      set_chat_notice(model, "File selection was cancelled.")

    UserAcceptedFile(transfer_id) -> accept_file(model, transfer_id)

    UserDeclinedFile(transfer_id) ->
      update_file_transfer(
        Model(
          ..model,
          transfers: transfer.mark_status(
            model.transfers,
            transfer_id,
            transfer.Declined,
            "Declined",
          ),
        ),
        shared_protocol.encode_file_decline(transfer_id),
      )

    UserCancelledFile(transfer_id) -> cancel_file(model, transfer_id)

    BrowserReceiveReady(transfer_id) ->
      update_file_transfer(
        Model(
          ..model,
          transfers: transfer.mark_status(
            model.transfers,
            transfer_id,
            transfer.Transferring,
            "Ready to receive",
          ),
        ),
        shared_protocol.encode_file_accept(transfer_id),
      )

    BrowserReceiveStartFailed(transfer_id, reason) ->
      update_file_transfer(
        Model(
          ..model,
          transfers: transfer.mark_status(
            model.transfers,
            transfer_id,
            transfer.Failed,
            reason,
          ),
        ),
        shared_protocol.encode_file_cancel(transfer_id),
      )

    BrowserReceiveUnsupported(transfer_id) -> #(
      Model(
        ..model,
        transfers: transfer.mark_status(
          model.transfers,
          transfer_id,
          transfer.Unsupported,
          "Stream-to-save is not supported in this browser",
        ),
      ),
      effect.none(),
    )

    BrowserFileChunkWritten(chunk) -> acknowledge_written_chunk(model, chunk)

    BrowserFileReceiveFailed(transfer_id, reason) ->
      fail_received_file(model, transfer_id, reason)

    WebSocketBinarySendFailed(transfer_id) ->
      update_file_transfer(
        Model(
          ..model,
          transfers: transfer.mark_status(
            model.transfers,
            transfer_id,
            transfer.Failed,
            "File chunk could not be sent.",
          ),
        ),
        shared_protocol.encode_file_cancel(transfer_id),
      )

    BrowserLoadedIdentity(device_id:, display_name:) -> #(
      Model(..model, device_id: device_id, display_name: display_name),
      effect.none(),
    )

    WebSocketOpened -> #(Model(..model, status: Connected), effect.none())

    WebSocketClosed -> #(Model(..model, status: Disconnected), effect.none())

    WebSocketFailed -> #(Model(..model, status: ConnectionError), effect.none())

    WebSocketSendFailed -> #(
      Model(
        ..model,
        status: ConnectionError,
        chat_notice: option.Some("Message could not be sent."),
      ),
      effect.none(),
    )

    WebSocketReceived(raw:) -> handle_server_event(model, raw)
  }
}

fn connect(model: Model) -> #(Model, Effect(Message)) {
  let name = normalized_display_name(model.display_name)
  let hello_json = shared_protocol.encode_peer_hello(model.device_id, name)

  #(
    Model(..model, display_name: name),
    browser.connect(
      name,
      hello_json,
      WebSocketOpened,
      WebSocketClosed,
      WebSocketFailed,
      WebSocketReceived,
      BrowserFileChunkWritten,
      BrowserFileReceiveFailed,
    ),
  )
}

fn handle_server_event(model: Model, raw: String) -> #(Model, Effect(Message)) {
  let log = list.append(model.log, [raw])

  case shared_protocol.decode_server_event(raw) {
    Ok(shared_protocol.PeerList(peers: peers)) -> #(
      Model(
        ..model,
        peers: peers,
        known_peers: chat.remember_peers(model.known_peers, peers),
        log: log,
      ),
      effect.none(),
    )

    Ok(shared_protocol.PeerJoined(peer: peer)) -> #(
      Model(
        ..model,
        peers: chat.upsert_peer(model.peers, peer),
        known_peers: chat.remember_peer(model.known_peers, peer),
        log: log,
      ),
      effect.none(),
    )

    Ok(shared_protocol.PeerLeft(device_id: device_id)) -> #(
      Model(..model, peers: chat.remove_peer(model.peers, device_id), log: log),
      effect.none(),
    )

    Ok(shared_protocol.TextMessageEvent(message: message)) -> #(
      apply_text_message(model, message, log),
      effect.none(),
    )

    Ok(shared_protocol.MessageHistory(messages: messages)) -> #(
      apply_message_history(model, messages, log),
      effect.none(),
    )

    Ok(shared_protocol.FileOffered(offer: offer)) -> #(
      apply_file_offered(model, offer, log),
      effect.none(),
    )

    Ok(shared_protocol.FileAccepted(transfer_id: transfer_id)) ->
      apply_file_accepted(model, transfer_id, log)

    Ok(shared_protocol.FileDeclined(transfer_id: transfer_id)) -> #(
      Model(
        ..model,
        transfers: transfer.mark_status(
          model.transfers,
          transfer_id,
          transfer.Declined,
          "Declined",
        ),
        log: log,
      ),
      effect.none(),
    )

    Ok(shared_protocol.FileCancelled(transfer_id: transfer_id, reason: reason)) -> #(
      Model(
        ..model,
        transfers: transfer.mark_status(
          model.transfers,
          transfer_id,
          transfer.Cancelled,
          reason,
        ),
        log: log,
      ),
      browser.close_receive_file(transfer_id),
    )

    Ok(shared_protocol.FileChunkAcknowledged(ack: ack)) ->
      apply_file_chunk_ack(model, ack, log)

    Ok(shared_protocol.FileCompleted(transfer_id: transfer_id)) -> #(
      Model(
        ..model,
        transfers: transfer.mark_status(
          model.transfers,
          transfer_id,
          transfer.Completed,
          "Complete",
        ),
        local_files: dict.delete(from: model.local_files, delete: transfer_id),
        log: log,
      ),
      effect.none(),
    )

    Ok(shared_protocol.ErrorEvent(code: code, message: message)) -> #(
      Model(
        ..model,
        log: log,
        chat_notice: chat.server_error_notice(code, message, model.chat_notice),
      ),
      effect.none(),
    )

    Ok(shared_protocol.UnknownServerEvent(event_type: _)) -> #(
      Model(..model, log: log),
      effect.none(),
    )

    Error(Nil) -> #(
      Model(..model, log: list.append(log, ["Unable to parse server event"])),
      effect.none(),
    )
  }
}

fn apply_text_message(
  model: Model,
  message: shared_protocol.TextMessage,
  log: List(String),
) -> Model {
  let peer_id = chat.conversation_peer_id(model.device_id, message)
  let messages_by_peer =
    chat.add_text_message(model.messages_by_peer, model.device_id, message)
  let unread_by_peer = case
    message.from != model.device_id
    && !chat.is_selected(model.selected_peer_id, peer_id)
  {
    True -> chat.increment_unread(model.unread_by_peer, peer_id)
    False -> model.unread_by_peer
  }
  let #(message_drafts, pending_draft_clear) =
    chat.clear_pending_draft(
      model.pending_draft_clear,
      model.message_drafts,
      message,
    )
  let chat_notice = case chat.is_selected(model.selected_peer_id, peer_id) {
    True -> option.None
    False -> model.chat_notice
  }

  Model(
    ..model,
    messages_by_peer: messages_by_peer,
    unread_by_peer: unread_by_peer,
    message_drafts: message_drafts,
    pending_draft_clear: pending_draft_clear,
    chat_notice: chat_notice,
    log: log,
  )
}

fn apply_message_history(
  model: Model,
  messages: List(shared_protocol.TextMessage),
  log: List(String),
) -> Model {
  Model(
    ..model,
    messages_by_peer: chat.add_text_messages(
      model.messages_by_peer,
      model.device_id,
      messages,
    ),
    log: log,
  )
}

fn select_file_for_current_peer(model: Model) -> #(Model, Effect(Message)) {
  case send_file_target(model) {
    Ok(peer_id) -> #(
      Model(..model, pending_file_peer_id: option.Some(peer_id)),
      browser.select_file(BrowserSelectedFile, BrowserFileSelectionFailed),
    )
    Error(notice) -> set_chat_notice(model, notice)
  }
}

fn send_file_target(model: Model) -> Result(String, String) {
  use Nil <- result.try(ensure_connected(model.status))
  use peer_id <- result.try(ensure_selected_peer(model.selected_peer_id))
  use Nil <- result.try(ensure_peer_online(model.peers, peer_id))

  Ok(peer_id)
}

fn send_file_offer(
  model: Model,
  selection: transfer.FileSelection,
) -> #(Model, Effect(Message)) {
  case model.pending_file_peer_id {
    option.None ->
      set_chat_notice(model, "Select an online peer before sharing a file.")
    option.Some(peer_id) -> {
      let peer_name = peer_display_name(model, peer_id)
      let payload =
        shared_protocol.encode_file_offer(
          peer_id,
          selection.transfer_id,
          selection.name,
          selection.size,
          selection.mime_type,
        )

      #(
        Model(
          ..model,
          pending_file_peer_id: option.None,
          chat_notice: option.None,
          transfers: transfer.add_outgoing(
            model.transfers,
            peer_id,
            peer_name,
            selection,
          ),
          local_files: dict.insert(
            into: model.local_files,
            for: selection.transfer_id,
            insert: transfer.local_file(selection),
          ),
        ),
        browser.send(payload, WebSocketSendFailed),
      )
    }
  }
}

fn accept_file(model: Model, transfer_id: String) -> #(Model, Effect(Message)) {
  case transfer.find(model.transfers, transfer_id) {
    option.None ->
      set_chat_notice(model, "That file transfer is no longer available.")
    option.Some(item) ->
      case item.status {
        transfer.Unsupported ->
          set_chat_notice(
            model,
            "This browser cannot stream incoming files to disk.",
          )
        transfer.Offered -> #(
          Model(
            ..model,
            transfers: transfer.mark_status(
              model.transfers,
              transfer_id,
              transfer.AwaitingSave,
              "Choose where to save this file",
            ),
          ),
          browser.start_receive_file(
            transfer_id,
            item.name,
            BrowserReceiveReady(transfer_id),
            fn(reason) { BrowserReceiveStartFailed(transfer_id, reason) },
            BrowserReceiveUnsupported(transfer_id),
          ),
        )
        transfer.AwaitingSave -> #(model, effect.none())
        transfer.Transferring -> #(model, effect.none())
        transfer.Completed -> #(model, effect.none())
        transfer.Failed -> #(model, effect.none())
        transfer.Cancelled -> #(model, effect.none())
        transfer.Declined -> #(model, effect.none())
      }
  }
}

fn cancel_file(model: Model, transfer_id: String) -> #(Model, Effect(Message)) {
  #(
    Model(
      ..model,
      transfers: transfer.mark_status(
        model.transfers,
        transfer_id,
        transfer.Cancelled,
        "Cancelled",
      ),
      local_files: dict.delete(from: model.local_files, delete: transfer_id),
    ),
    effect.batch([
      browser.send(
        shared_protocol.encode_file_cancel(transfer_id),
        WebSocketSendFailed,
      ),
      browser.close_receive_file(transfer_id),
    ]),
  )
}

fn update_file_transfer(
  model: Model,
  payload: String,
) -> #(Model, Effect(Message)) {
  #(model, browser.send(payload, WebSocketSendFailed))
}

fn acknowledge_written_chunk(
  model: Model,
  chunk: browser.WrittenChunk,
) -> #(Model, Effect(Message)) {
  let ack =
    shared_protocol.FileChunkAck(
      transfer_id: chunk.transfer_id,
      sequence: chunk.sequence,
      offset: chunk.offset,
      byte_length: chunk.byte_length,
      final: chunk.final,
    )

  #(
    Model(..model, transfers: transfer.mark_progress(model.transfers, ack)),
    browser.send(
      shared_protocol.encode_file_chunk_ack(ack),
      WebSocketSendFailed,
    ),
  )
}

fn fail_received_file(
  model: Model,
  transfer_id: String,
  reason: String,
) -> #(Model, Effect(Message)) {
  let model =
    Model(
      ..model,
      transfers: transfer.mark_status(
        model.transfers,
        transfer_id,
        transfer.Failed,
        reason,
      ),
    )

  case transfer_id {
    "" -> #(model, effect.none())
    _ -> #(
      model,
      browser.send(
        shared_protocol.encode_file_cancel(transfer_id),
        WebSocketSendFailed,
      ),
    )
  }
}

fn apply_file_offered(
  model: Model,
  offer: shared_protocol.FileOffer,
  log: List(String),
) -> Model {
  Model(
    ..model,
    transfers: transfer.add_incoming(
      model.transfers,
      offer,
      peer_display_name(model, offer.from),
      browser.stream_save_supported(),
    ),
    log: log,
  )
}

fn apply_file_accepted(
  model: Model,
  transfer_id: String,
  log: List(String),
) -> #(Model, Effect(Message)) {
  let model =
    Model(
      ..model,
      transfers: transfer.mark_status(
        model.transfers,
        transfer_id,
        transfer.Transferring,
        "Transferring",
      ),
      log: log,
    )

  case dict.get(model.local_files, transfer_id) {
    Ok(file) -> #(model, send_next_file_chunk(transfer_id, file))
    Error(_) -> #(model, effect.none())
  }
}

fn apply_file_chunk_ack(
  model: Model,
  ack: shared_protocol.FileChunkAck,
  log: List(String),
) -> #(Model, Effect(Message)) {
  let transfers = transfer.mark_progress(model.transfers, ack)

  case dict.get(model.local_files, ack.transfer_id) {
    Ok(file) -> {
      let updated_file = transfer.update_local_file_after_ack(file, ack)
      let local_files = case ack.final {
        True -> dict.delete(from: model.local_files, delete: ack.transfer_id)
        False ->
          dict.insert(
            into: model.local_files,
            for: ack.transfer_id,
            insert: updated_file,
          )
      }
      let effect = case ack.final {
        True -> effect.none()
        False -> send_next_file_chunk(ack.transfer_id, updated_file)
      }

      #(
        Model(..model, transfers: transfers, local_files: local_files, log: log),
        effect,
      )
    }
    Error(_) -> #(Model(..model, transfers: transfers, log: log), effect.none())
  }
}

fn send_next_file_chunk(
  transfer_id: String,
  file: transfer.LocalFile,
) -> Effect(Message) {
  browser.send_file_chunk(
    file.file_id,
    transfer_id,
    file.next_sequence,
    file.next_offset,
    chunk_size,
    WebSocketBinarySendFailed(transfer_id),
  )
}

fn send_message(model: Model) -> #(Model, Effect(Message)) {
  case send_message_request(model) {
    Ok(SendMessageRequest(peer_id:, body:)) ->
      send_text_message(model, peer_id, body)
    Error(notice) -> set_chat_notice(model, notice)
  }
}

fn send_message_request(model: Model) -> Result(SendMessageRequest, String) {
  use Nil <- result.try(ensure_connected(model.status))
  use peer_id <- result.try(ensure_selected_peer(model.selected_peer_id))
  use Nil <- result.try(ensure_peer_online(model.peers, peer_id))
  let body = string.trim(draft_for_peer(model, peer_id))
  use Nil <- result.try(ensure_message_body(body))

  Ok(SendMessageRequest(peer_id: peer_id, body: body))
}

fn ensure_connected(status: Status) -> Result(Nil, String) {
  case status {
    Connected -> Ok(Nil)
    Disconnected -> Error("Connect before sending messages.")
    ConnectionError -> Error("Connect before sending messages.")
  }
}

fn ensure_selected_peer(
  selected_peer_id: option.Option(String),
) -> Result(String, String) {
  case selected_peer_id {
    option.Some(peer_id) -> Ok(peer_id)
    option.None -> Error("Select a peer before sending.")
  }
}

fn ensure_peer_online(
  peers: List(shared_protocol.Peer),
  peer_id: String,
) -> Result(Nil, String) {
  case chat.peer_is_online(peers, peer_id) {
    True -> Ok(Nil)
    False -> Error("That peer is offline.")
  }
}

fn ensure_message_body(body: String) -> Result(Nil, String) {
  case body {
    "" -> Error("Type a message before sending.")
    _ -> Ok(Nil)
  }
}

fn update_selected_draft(model: Model, body: String) -> Model {
  case model.selected_peer_id {
    option.Some(peer_id) ->
      Model(
        ..model,
        message_drafts: set_draft(model.message_drafts, peer_id, body),
      )
    option.None -> model
  }
}

fn draft_for_peer(model: Model, peer_id: String) -> String {
  case dict.get(model.message_drafts, peer_id) {
    Ok(body) -> body
    Error(_) -> ""
  }
}

fn set_draft(
  drafts: dict.Dict(String, String),
  peer_id: String,
  body: String,
) -> dict.Dict(String, String) {
  case body {
    "" -> dict.delete(from: drafts, delete: peer_id)
    _ -> dict.insert(into: drafts, for: peer_id, insert: body)
  }
}

fn send_text_message(
  model: Model,
  peer_id: String,
  body: String,
) -> #(Model, Effect(Message)) {
  let payload = shared_protocol.encode_text_send(peer_id, body)

  #(
    Model(
      ..model,
      message_drafts: set_draft(model.message_drafts, peer_id, body),
      chat_notice: option.None,
      pending_draft_clear: option.Some(chat.PendingDraftClear(
        to: peer_id,
        body: body,
      )),
    ),
    browser.send(payload, WebSocketSendFailed),
  )
}

fn set_chat_notice(model: Model, notice: String) -> #(Model, Effect(Message)) {
  #(Model(..model, chat_notice: option.Some(notice)), effect.none())
}

fn normalized_display_name(display_name: String) -> String {
  case string.trim(display_name) {
    "" -> "Glim Peer"
    name -> name
  }
}

fn view(model: Model) -> Element(Message) {
  shell.view(shell.Props(
    is_peer_selected: option.is_some(model.selected_peer_id),
    display_name: model.display_name,
    mesh_action_label: top_mesh_action_label(model.status),
    on_connect: UserClickedConnect,
    sidebar: sidebar.view(sidebar_props(model)),
    chat: chat_panel.view(chat_panel_props(model)),
    transfer_queue: transfer_queue.view(transfer_queue.Props(
      transfers: model.transfers,
      on_cancel: UserCancelledFile,
    )),
    log_drawer: log_drawer.view(log_drawer.Props(
      log: model.log,
      on_clear: UserClickedClearLog,
    )),
  ))
}

fn sidebar_props(model: Model) -> sidebar.Props(Message) {
  let active_peer_count =
    model.peers
    |> list.filter(fn(peer) { peer.id != model.device_id })
    |> list.length

  let unread_total =
    model.unread_by_peer
    |> dict.values
    |> list.fold(0, fn(total, count) { total + count })

  sidebar.Props(
    status_label: mesh_status_label(model.status),
    active_peer_count: active_peer_count,
    unread_total: unread_total,
    peers: sidebar_peer_items(model),
    on_select_peer: UserSelectedPeer,
    on_share_file: UserClickedShareFile,
  )
}

fn sidebar_peer_items(model: Model) -> List(sidebar.PeerItem) {
  let online_peers =
    model.peers
    |> list.filter(fn(peer) { peer.id != model.device_id })

  let online_items =
    online_peers
    |> list.map(fn(peer) {
      sidebar_peer_item(model, peer.id, peer.display_name, True)
    })

  let offline_items =
    model.messages_by_peer
    |> dict.keys
    |> list.filter(fn(peer_id) {
      peer_id != model.device_id && !peer_in_list(online_peers, peer_id)
    })
    |> list.sort(string.compare)
    |> list.map(fn(peer_id) {
      sidebar_peer_item(
        model,
        peer_id,
        peer_display_name(model, peer_id),
        False,
      )
    })

  list.append(online_items, offline_items)
}

fn sidebar_peer_item(
  model: Model,
  peer_id: String,
  display_name: String,
  is_online: Bool,
) -> sidebar.PeerItem {
  let selected = chat.is_selected(model.selected_peer_id, peer_id)

  sidebar.PeerItem(
    id: peer_id,
    display_name: display_name,
    subtitle: case is_online {
      True -> peer_id
      False -> "Offline - " <> peer_id
    },
    initial: initial(display_name),
    avatar_class: sidebar_avatar_class(peer_id, selected),
    unread_count: chat.unread_count(model.unread_by_peer, peer_id),
    selected: selected,
  )
}

fn chat_panel_props(model: Model) -> chat_panel.Props(Message) {
  chat_panel.Props(
    selected_chat: selected_chat(model),
    chat_notice: chat_notice(model),
    on_deselect: UserDeselectedPeer,
    on_type_message: UserTypedMessage,
    on_keydown: UserPressedMessageKey,
    on_send: UserClickedSendMessage,
    on_attach_file: UserClickedShareFile,
    on_accept_file: UserAcceptedFile,
    on_decline_file: UserDeclinedFile,
    on_cancel_file: UserCancelledFile,
  )
}

fn selected_chat(model: Model) -> option.Option(chat_panel.SelectedChat) {
  case model.selected_peer_id {
    option.None -> option.None
    option.Some(peer_id) -> {
      let peer_name = peer_display_name(model, peer_id)

      option.Some(chat_panel.SelectedChat(
        peer_id: peer_id,
        peer_name: peer_name,
        peer_initial: initial(peer_name),
        is_online: chat.peer_is_online(model.peers, peer_id),
        draft: draft_for_peer(model, peer_id),
        messages: message_items(model),
        transfers: transfer.items_for_peer(model.transfers, peer_id),
      ))
    }
  }
}

fn message_items(model: Model) -> List(chat_panel.MessageItem) {
  chat.messages_for_peer(model.messages_by_peer, model.selected_peer_id)
  |> list.map(fn(message) { message_item(model, message) })
}

fn message_item(
  model: Model,
  message: shared_protocol.TextMessage,
) -> chat_panel.MessageItem {
  let is_self = message.from == model.device_id

  chat_panel.MessageItem(
    id: message.id,
    body: message.body,
    time: browser.format_time(message.created_at_ms),
    is_self: is_self,
    author_initial: message_author_initial(model, message, is_self),
    avatar_class: message_avatar_class(message.from, is_self),
  )
}

fn message_author_initial(
  model: Model,
  message: shared_protocol.TextMessage,
  is_self: Bool,
) -> String {
  case is_self {
    True -> initial(model.display_name)
    False -> initial(peer_display_name(model, message.from))
  }
}

fn peer_display_name(model: Model, peer_id: String) -> String {
  case chat.find_peer(model.known_peers, peer_id) {
    option.Some(peer) -> peer.display_name
    option.None -> peer_id
  }
}

fn peer_in_list(peers: List(shared_protocol.Peer), peer_id: String) -> Bool {
  peers
  |> list.any(fn(peer) { peer.id == peer_id })
}

fn initial(value: String) -> String {
  value
  |> string.first
  |> result.unwrap("P")
  |> string.uppercase
}

fn sidebar_avatar_class(peer_id: String, selected: Bool) -> String {
  case selected {
    True -> "bg-on-primary/10 text-on-primary border border-on-primary/20"
    False -> avatar_palette_class(peer_id)
  }
}

fn message_avatar_class(peer_id: String, is_self: Bool) -> String {
  case is_self {
    True -> "bg-primary-fixed text-primary border border-primary-fixed-dim"
    False -> avatar_palette_class(peer_id)
  }
}

fn avatar_palette_class(peer_id: String) -> String {
  case string_hash(peer_id) % 4 {
    0 -> "bg-rose-100 text-rose-800 border border-rose-200"
    1 -> "bg-emerald-100 text-emerald-800 border border-emerald-200"
    2 -> "bg-sky-100 text-sky-800 border border-sky-200"
    _ -> "bg-violet-100 text-violet-800 border border-violet-200"
  }
}

fn chat_notice(model: Model) -> String {
  case model.chat_notice {
    option.Some(message) -> message
    option.None -> ""
  }
}

fn mesh_status_label(status: Status) -> String {
  case status {
    Connected -> "Discovery Active"
    Disconnected -> "Mesh Offline"
    ConnectionError -> "Connection Issue"
  }
}

fn top_mesh_action_label(status: Status) -> String {
  case status {
    Connected -> "Mesh Online"
    Disconnected -> "Start Mesh"
    ConnectionError -> "Retry Mesh"
  }
}

fn string_hash(s: String) -> Int {
  s
  |> string.to_utf_codepoints
  |> list.fold(0, fn(acc, cp) { acc + string.utf_codepoint_to_int(cp) })
}
