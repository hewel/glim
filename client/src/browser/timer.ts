export function delay(milliseconds: number, callback: () => void): void {
  setTimeout(callback, Math.max(0, milliseconds));
}

export function formatTime(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
