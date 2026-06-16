-- name: InsertTextMessage :one
INSERT INTO messages (
  from_device_id,
  to_device_id,
  body,
  created_at_ms
) VALUES (
  ?,
  ?,
  ?,
  ?
)
RETURNING
  id,
  from_device_id,
  to_device_id,
  body,
  created_at_ms;

-- name: SelectDeviceMessageHistory :many
SELECT
  id,
  from_device_id,
  to_device_id,
  body,
  created_at_ms
FROM messages
WHERE from_device_id = ? OR to_device_id = ?
ORDER BY id ASC;

-- name: InsertTransferHistory :one
INSERT INTO transfer_history (
  transfer_id,
  client_offer_id,
  from_device_id,
  from_display_name,
  to_device_id,
  to_display_name,
  file_name,
  file_size,
  mime_type,
  final_status,
  transferred_bytes,
  reason,
  recorded_at_ms
) VALUES (
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?
)
ON CONFLICT(transfer_id) DO UPDATE SET
  client_offer_id = excluded.client_offer_id,
  from_device_id = excluded.from_device_id,
  from_display_name = excluded.from_display_name,
  to_device_id = excluded.to_device_id,
  to_display_name = excluded.to_display_name,
  file_name = excluded.file_name,
  file_size = excluded.file_size,
  mime_type = excluded.mime_type,
  final_status = excluded.final_status,
  transferred_bytes = excluded.transferred_bytes,
  reason = excluded.reason,
  recorded_at_ms = excluded.recorded_at_ms
RETURNING
  id,
  transfer_id,
  client_offer_id,
  from_device_id,
  from_display_name,
  to_device_id,
  to_display_name,
  file_name,
  file_size,
  mime_type,
  final_status,
  transferred_bytes,
  reason,
  recorded_at_ms;

-- name: SelectDeviceTransferHistory :many
SELECT
  id,
  transfer_id,
  client_offer_id,
  from_device_id,
  from_display_name,
  to_device_id,
  to_display_name,
  file_name,
  file_size,
  mime_type,
  final_status,
  transferred_bytes,
  reason,
  recorded_at_ms
FROM transfer_history
WHERE from_device_id = ? OR to_device_id = ?
ORDER BY recorded_at_ms ASC, id ASC;
