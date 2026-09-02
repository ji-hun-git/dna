/** Shortens a sha256 hex digest for visible copy: first 12 and last 8 characters. */
export function shortDigest(value: string) {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}
