import gleam/string

pub const max_display_name_length = 64

pub type ValidationError {
  EmptyDeviceId
  EmptyDisplayName
  DisplayNameTooLong(max: Int)
}

pub fn validate_device_id(
  device_id: String,
) -> Result(String, ValidationError) {
  let trimmed = string.trim(device_id)
  case trimmed {
    "" -> Error(EmptyDeviceId)
    _ -> Ok(trimmed)
  }
}

pub fn validate_display_name(
  display_name: String,
) -> Result(String, ValidationError) {
  let trimmed = string.trim(display_name)
  case trimmed {
    "" -> Error(EmptyDisplayName)
    _ -> {
      case string.length(trimmed) > max_display_name_length {
        True -> Error(DisplayNameTooLong(max: max_display_name_length))
        False -> Ok(trimmed)
      }
    }
  }
}
