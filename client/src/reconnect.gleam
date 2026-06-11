pub fn retry_delay_ms(attempt: Int) -> Int {
  case attempt {
    n if n <= 1 -> 1000
    2 -> 2000
    3 -> 5000
    4 -> 10_000
    _ -> 30_000
  }
}
