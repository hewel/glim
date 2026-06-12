# Glim

Local-network messaging and file sharing between devices that join the same shared room without account registration.

## Language

**Device**:
A browser-held identity for one participant on the local network, stable across reconnects from the same browser.
_Avoid_: User, account, profile

**Peer**:
A device that is currently connected to the shared room and visible in presence.
_Avoid_: Contact, user, client

**Message history**:
Persisted text messages involving a device, available again when that device reconnects.
_Avoid_: Chat cache, transcript, archive

**File transfer**:
An accepted file exchange between two peers in the shared room, regardless of how the bytes move.
_Avoid_: Upload, download, file sync

**Transfer mode**:
The transport choice used for a file transfer, such as relay or peer-to-peer.
_Avoid_: Transfer type, backend, protocol
