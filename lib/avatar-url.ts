/**
 * Where a trader's picture is served from, or null when they have none.
 *
 * The version token is in the URL rather than left to a header: a picture can
 * be replaced, and a stable URL with a long cache would keep showing the old
 * one. A new upload is a new URL, so the response can be cached hard.
 *
 * Only the object's id travels, never the storage path — the same rule as
 * trade attachments. The route re-checks the session either way.
 */
export function avatarUrl(address: string, path: string | null): string | null {
  if (!path) return null;
  const version = path.split("/").pop()?.split(".")[0];
  return version ? `/api/traders/${address}/avatar?v=${version}` : null;
}
