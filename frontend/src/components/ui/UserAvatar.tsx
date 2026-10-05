import { getAvatarIndex, getAvatarInitial } from "../../lib/avatar";

// Original editorial portraits share a drawing scale, ink and paper in both themes.
const PORTRAITS = [
  { hair: "M22 36C15 30 17 18 26 15C27 7 44 6 52 13C64 12 67 29 58 36L52 30L49 21C40 27 29 25 25 29Z", part: "M29 17C36 14 42 15 47 18" },
  { rear: "M21 26C14 37 16 59 22 66H31L32 48H50L51 66H61C68 51 64 24 54 17Z", hair: "M20 36C14 14 35 6 49 13C61 13 66 25 59 37L53 30L49 22C42 27 31 29 25 27L23 36Z", part: "M25 20C31 15 37 15 40 16" },
  { hair: "M22 35C15 34 14 25 20 21C16 14 23 8 30 12C34 4 44 6 47 12C55 7 62 14 59 21C67 25 64 34 57 36L51 28C46 31 41 27 40 24C35 29 29 25 26 27Z" },
  { rear: "M21 24C13 40 17 62 26 67L34 52H49L57 67C67 56 67 36 57 22Z", hair: "M22 35C16 25 22 13 33 11C28 4 35 1 42 4C52 1 59 10 52 16C61 20 64 29 58 37L52 30L48 21C41 25 32 25 26 28Z", part: "M32 17C38 14 44 15 49 18" },
  { rear: "M20 28C14 34 20 41 16 48C11 59 21 67 31 64L35 50H49L55 65C66 64 69 56 63 49C68 42 65 29 59 24Z", hair: "M21 36C16 20 28 10 39 12C52 8 65 19 60 34L55 35L50 28C42 27 40 22 39 19C34 27 31 27 25 29Z", part: "M40 18C45 17 52 20 55 25" },
  { hair: "M22 34L20 22C20 15 27 10 40 10C51 9 61 16 60 27L58 36L52 30L49 22L29 24L25 34Z", glasses: true },
  { rear: "M55 27C69 24 71 37 66 44C72 50 70 63 61 65L58 51L53 42Z", hair: "M22 36C15 28 20 13 32 11C47 7 63 17 59 36L53 30L48 21C41 27 32 28 26 29Z", part: "M28 19C34 16 41 17 45 19" },
  { rear: "M20 45C10 43 10 34 15 29C9 23 16 15 22 15C21 7 31 3 37 8C44 1 55 7 55 13C64 10 70 22 64 27C73 33 66 43 61 44L54 37L28 38Z", hair: "M21 35L22 27C30 28 36 23 39 19C43 26 48 29 56 27L59 36L53 35L51 29L27 29L25 36Z" },
] as const;

function Portrait({ index }: { index: number }) {
  const portrait = PORTRAITS[index];
  return <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    {"rear" in portrait && <path d={portrait.rear} fill="currentColor" stroke="none" />}
    <path d="M33 60V68L20 73C15 75 13 79 12 83H69C68 78 65 74 60 72L48 68V60" fill="var(--avatar-paper)" />
    <path d="M32 68L40 75L49 68M40 75V81" />
    <path d="M23 29C23 18 52 17 56 29V36C62 32 66 38 63 43C61 46 58 47 56 45C54 57 49 62 40 63C30 63 23 56 23 43Z" fill="var(--avatar-paper)" />
    <path d={portrait.hair} fill="currentColor" stroke="none" />
    {"part" in portrait && <path d={portrait.part} stroke="var(--avatar-paper)" strokeWidth="2.5" />}
    <path d="M28 34L32 33M41 33L45 34" strokeWidth="2.5" />
    <path d="M35 41L33 47H36M36 54C39 56 43 55 45 52" strokeWidth="2.5" />
    <path d="M58 39L59 40" strokeWidth="2" />
    <ellipse cx="30" cy="40" rx="1.6" ry="2.3" fill="currentColor" stroke="none" />
    <ellipse cx="43" cy="40" rx="1.6" ry="2.3" fill="currentColor" stroke="none" />
    {"glasses" in portrait && <g strokeWidth="2">
      <rect x="25" y="36" width="11" height="9" rx="3" /><rect x="39" y="36" width="11" height="9" rx="3" />
      <path d="M36 39H39M50 39L56 37" />
    </g>}
  </svg>;
}

export function UserAvatar({ userId, email, size = 28 }: {
  userId?: number | string | null;
  email?: string | null;
  size?: 28 | 34;
}) {
  const index = getAvatarIndex(userId);
  return <span className="user-avatar" aria-hidden="true" data-avatar-index={index ?? "initial"} style={{ width: size, height: size }}>
    {index == null ? getAvatarInitial(email) : <Portrait index={index} />}
  </span>;
}
