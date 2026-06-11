CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  from_device_id TEXT NOT NULL,
  to_device_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);
