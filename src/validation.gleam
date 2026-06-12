import gleam/string

pub const max_display_name_length = 64

pub const max_text_message_length = 10_000

pub const max_transfer_id_length = 128

pub const max_file_name_length = 255

pub const max_mime_type_length = 128

pub const max_device_model_length = 80

pub type ValidationError {
  EmptyDeviceId
  EmptyDisplayName
  DisplayNameTooLong(max: Int)
  EmptyTextBody
  TextBodyTooLong(max: Int)
  EmptyTransferId
  TransferIdTooLong(max: Int)
  EmptyFileName
  FileNameTooLong(max: Int)
  NegativeFileSize
  MimeTypeTooLong(max: Int)
  InvalidDeviceKind
  InvalidDeviceOs
  InvalidDeviceBrowser
  DeviceModelTooLong(max: Int)
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

pub fn validate_text_body(body: String) -> Result(String, ValidationError) {
  let trimmed = string.trim(body)
  case trimmed {
    "" -> Error(EmptyTextBody)
    _ -> {
      case string.length(trimmed) > max_text_message_length {
        True -> Error(TextBodyTooLong(max: max_text_message_length))
        False -> Ok(trimmed)
      }
    }
  }
}

pub fn validate_transfer_id(
  transfer_id: String,
) -> Result(String, ValidationError) {
  let trimmed = string.trim(transfer_id)
  case trimmed {
    "" -> Error(EmptyTransferId)
    _ -> {
      case string.length(trimmed) > max_transfer_id_length {
        True -> Error(TransferIdTooLong(max: max_transfer_id_length))
        False -> Ok(trimmed)
      }
    }
  }
}

pub fn validate_file_name(name: String) -> Result(String, ValidationError) {
  let trimmed = string.trim(name)
  case trimmed {
    "" -> Error(EmptyFileName)
    _ -> {
      case string.length(trimmed) > max_file_name_length {
        True -> Error(FileNameTooLong(max: max_file_name_length))
        False -> Ok(trimmed)
      }
    }
  }
}

pub fn validate_file_size(size: Int) -> Result(Int, ValidationError) {
  case size < 0 {
    True -> Error(NegativeFileSize)
    False -> Ok(size)
  }
}

pub fn validate_mime_type(
  mime_type: String,
) -> Result(String, ValidationError) {
  let trimmed = string.trim(mime_type)
  case string.length(trimmed) > max_mime_type_length {
    True -> Error(MimeTypeTooLong(max: max_mime_type_length))
    False -> Ok(trimmed)
  }
}

pub fn validate_device_kind(kind: String) -> Result(String, ValidationError) {
  let trimmed = string.trim(kind)
  case trimmed {
    "phone" -> Ok(trimmed)
    "tablet" -> Ok(trimmed)
    "desktop" -> Ok(trimmed)
    "tv" -> Ok(trimmed)
    "unknown" -> Ok(trimmed)
    _ -> Error(InvalidDeviceKind)
  }
}

pub fn validate_device_os(os: String) -> Result(String, ValidationError) {
  let trimmed = string.trim(os)
  case trimmed {
    "android" -> Ok(trimmed)
    "ios" -> Ok(trimmed)
    "ipados" -> Ok(trimmed)
    "windows" -> Ok(trimmed)
    "macos" -> Ok(trimmed)
    "linux" -> Ok(trimmed)
    "unknown" -> Ok(trimmed)
    _ -> Error(InvalidDeviceOs)
  }
}

pub fn validate_device_browser(
  browser: String,
) -> Result(String, ValidationError) {
  let trimmed = string.trim(browser)
  case trimmed {
    "chrome" -> Ok(trimmed)
    "firefox" -> Ok(trimmed)
    "safari" -> Ok(trimmed)
    "edge" -> Ok(trimmed)
    "unknown" -> Ok(trimmed)
    _ -> Error(InvalidDeviceBrowser)
  }
}

pub fn validate_device_model(model: String) -> Result(String, ValidationError) {
  let trimmed = string.trim(model)
  case string.length(trimmed) > max_device_model_length {
    True -> Error(DeviceModelTooLong(max: max_device_model_length))
    False -> Ok(trimmed)
  }
}
