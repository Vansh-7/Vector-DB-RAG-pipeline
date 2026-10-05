export const AVATAR_COUNT = 8;

/** Default identity is derived from the account ID, never stored or fetched. */
export function getAvatarIndex(userId: number | string | null | undefined): number | null {
  if (userId == null || (typeof userId === "number" && !Number.isFinite(userId))) return null;
  const identity = String(userId).trim();
  if (!identity) return null;
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) % AVATAR_COUNT;
}

export function getAvatarInitial(email?: string | null): string {
  return Array.from(email?.trim() || "U")[0].toUpperCase();
}
