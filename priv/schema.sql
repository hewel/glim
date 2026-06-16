CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  from_device_id TEXT NOT NULL,
  to_device_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transfer_history (
  id INTEGER PRIMARY KEY,
  transfer_id TEXT NOT NULL UNIQUE,
  client_offer_id TEXT,
  from_device_id TEXT NOT NULL,
  from_display_name TEXT NOT NULL,
  to_device_id TEXT NOT NULL,
  to_display_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  final_status TEXT NOT NULL,
  transferred_bytes INTEGER NOT NULL,
  reason TEXT,
  recorded_at_ms INTEGER NOT NULL
);
