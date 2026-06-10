import gleeunit
import validation

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn validate_device_id_trims_test() {
  let assert Ok("device_abc") = validation.validate_device_id(" device_abc ")
}

pub fn validate_device_id_rejects_blank_test() {
  let assert Error(validation.EmptyDeviceId) =
    validation.validate_device_id("   ")
}

pub fn validate_display_name_trims_test() {
  let assert Ok("Zed") = validation.validate_display_name(" Zed ")
}

pub fn validate_display_name_rejects_blank_test() {
  let assert Error(validation.EmptyDisplayName) =
    validation.validate_display_name("   ")
}

pub fn validate_display_name_rejects_too_long_test() {
  let long_name = repeat_char("A", 65)
  let assert Error(validation.DisplayNameTooLong(max: 64)) =
    validation.validate_display_name(long_name)
}

fn repeat_char(char: String, count: Int) -> String {
  case count {
    0 -> ""
    n -> char <> repeat_char(char, n - 1)
  }
}
