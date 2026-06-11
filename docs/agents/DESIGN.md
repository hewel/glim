---
name: LocalLink
colors:
  surface: '#fbf9ff'
  surface-dim: '#dbd8e4'
  surface-bright: '#fbf9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2fe'
  surface-container: '#f0edf8'
  surface-container-high: '#e9e7f2'
  surface-container-highest: '#e3e1ec'
  on-surface: '#1b1b23'
  on-surface-variant: '#454654'
  inverse-surface: '#303038'
  inverse-on-surface: '#f2effb'
  outline: '#767686'
  outline-variant: '#c6c5d7'
  surface-tint: '#434cd7'
  primary: '#4049d4'
  on-primary: '#ffffff'
  primary-container: '#5a64ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#bec2ff'
  secondary: '#555a92'
  on-secondary: '#ffffff'
  secondary-container: '#bbbffe'
  on-secondary-container: '#484c83'
  tertiary: '#8d4b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#b15f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bec2ff'
  on-primary-fixed: '#00016d'
  on-primary-fixed-variant: '#272fbf'
  background: '#f8f5ff'
  on-background: '#1b1b23'
  surface-variant: '#e3e1ec'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
---

# LocalLink Design System

## Product Direction

LocalLink is the browser client for LAN Share IM: a local-network messaging and file-sharing tool for devices in the same shared room. The interface should feel like a focused operations console for nearby devices, not a social network or cloud drive.

The product language is built around the domain terms in `CONTEXT.md`:

- **Device** is the browser-held identity.
- **Peer** is another currently connected device.
- **Message history** is persisted text involving the device.
- **File transfer** is an online-only relay between two connected peers.

Avoid user/account/profile language in UI copy. Prefer peer, device, mesh, transfer, and room.

## Visual Style

The current client uses a light technical workspace with restrained indigo primary actions, amber transfer accents, and pale lavender surface layers. Keep the interface dense enough for repeated use, but readable at a glance.

Primary goals:

- Make connection state, selected peer, and transfer progress visible without explanation text.
- Keep chat and transfer workflows in the first viewport.
- Use icon-led controls for common actions such as attach, send, accept, decline, cancel, and clear log.
- Prefer thin borders, tonal layers, and small monospaced labels over decorative shadows.

Do not introduce marketing-style hero sections, decorative gradients, large empty cards, or one-off illustrations. The first screen is the usable mesh/chat/transfer interface.

## Layout

The main application is a three-pane operational layout:

- **Top bar:** brand, mesh action/status, global utility icons, and local device badge.
- **Left sidebar:** local mesh status, peer list, unread chat counts, and file-share entry point.
- **Center chat panel:** selected peer header, message history, file transfer cards, and composer.
- **Right transfer queue:** online-only file transfer progress, active count, cancellation, and completed count.
- **Developer log:** collapsed diagnostic drawer at the bottom.

Desktop keeps all panes visible when space allows. Mobile prioritizes the peer list until a peer is selected, then shows the chat panel with a back action. The right transfer queue can remain desktop-only; transfer cards in the chat timeline must carry the essential state on smaller screens.

## Interaction Rules

### Mesh and Chat

- Identity load automatically starts the mesh session and sends `peer.hello`.
- The mesh action retries the current session immediately when disconnected or reconnecting.
- Selecting a peer clears unread count for that peer.
- Text messages require a connected session, selected peer, online peer, and non-empty body.
- Message history is restored state; do not mark replayed messages unread.
- Offline peers can appear when history exists, but sending to them must be blocked.

### File Transfer

File transfers are online-only and require both peers to remain connected. They are not persisted and are not part of message history.

The UI must represent these states:

- Offered: pending receiver response.
- Awaiting save: receiver accepted intent and is choosing a save target.
- Transferring: chunks are streaming with receiver ACK pacing.
- Completed: final chunk written and acknowledged.
- Declined: receiver rejected the offer.
- Cancelled: either side cancelled the transfer.
- Failed: browser, socket, save-stream, or connection-loss error.
- Unsupported: receiver browser cannot stream to a save target.

The sender sends one 256 KiB chunk at a time. The receiver writes the chunk to the selected save stream before sending `file.chunk_ack`. This flow preserves no-app-cap semantics by avoiding full in-memory assembly.

When stream-to-save APIs are unsupported, the receiver must not accept the file. Show unsupported state and allow decline/cancel.

## Component Guidance

- **Peer item:** show display name, device id or offline label, unread badge, and selected state. Avatar initials are enough; do not add profile imagery.
- **Composer:** keep text input, attach, mood placeholder, and send controls compact. Attach opens file selection only for a connected, selected, online peer.
- **Transfer card:** show file icon, name, direction, peer, progress bar, byte progress, status label, and action buttons relevant to the current state.
- **Transfer queue:** show newest transfers first, active count in the header, and a compact telemetry footer. It should reflect real transfer state rather than static sample files.
- **Notices:** use the existing chat notice area for send/transfer validation errors. Keep messages short and actionable.
- **Log drawer:** diagnostic only; it should not become the primary user feedback channel.

## Accessibility and Responsiveness

- All icon-only buttons need either visible context or `title`/accessible labeling in implementation.
- Button text must fit at mobile widths; use short labels such as Accept, Decline, Cancel, Send.
- Keep transfer status readable without relying only on color.
- Preserve keyboard send with Enter for text messages.
- Do not hide essential transfer state solely in the desktop right rail; mirror active transfer cards in chat.

## Copy Tone

Use concise operational copy:

- "Mesh Online", "Discovery Active", "Connecting", "Reconnecting", "Connection Issue"
- "Select a peer before sending."
- "That peer is offline."
- "Choose where to save this file"
- "Stream-to-save is not supported in this browser"
- "Peer disconnected."

Avoid consumer/social copy such as "friends", "profiles", "upload to cloud", "inbox", or "followers".

## Current Constraints

- The server persists accepted text messages in SQLite.
- File transfers are relayed over WebSocket only while both peers are online.
- Browser clients auto-reconnect with bounded backoff after WebSocket loss.
- File bytes use binary WebSocket frames with a length-prefixed JSON header.
- The right rail is a transfer queue, not a general file library.
- There are no upload/download HTTP endpoints and no LAN auto-discovery yet.
