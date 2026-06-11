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
