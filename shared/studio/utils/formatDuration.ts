/**
 * @param duration Duration in milliseconds
 */
export function formatDuration(duration: number) {
  if (duration < 1_000) {
    return `${duration}ms`;
  }
  if (duration < 60_000) {
    return `${(duration / 1_000).toFixed(2)}s`;
  }
  const min = Math.floor(duration / 60_000);
  const sec = Math.round(duration - min * 60_000);
  return `${min}min` + sec ? ` ${sec}s` : "";
}
