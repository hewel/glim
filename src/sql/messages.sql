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
