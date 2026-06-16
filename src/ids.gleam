import gleam/bit_array
import gleam/crypto

pub fn transfer_id() -> String {
  "transfer_" <> random_token()
}

pub fn transfer_token() -> String {
  random_token()
}

fn random_token() -> String {
  crypto.strong_random_bytes(18)
  |> bit_array.base64_url_encode(False)
}
