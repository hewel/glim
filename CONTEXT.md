# LAN Share IM

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
