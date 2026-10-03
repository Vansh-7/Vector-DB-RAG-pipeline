// Shared by the static Vite head and client route effects. No product imports.
export const LANDING_TITLE = "Neuebit — Your knowledge, in context";
export const LANDING_DESCRIPTION = "Ask your documents, search by meaning, and trace answers to their sources. Neuebit is an AI knowledge workspace built on a custom vector engine.";
export const SOCIAL_IMAGE_ALT = "Neuebit. Your knowledge, in context. An AI knowledge workspace with a custom vector engine.";

export function publicSiteUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("VITE_PUBLIC_SITE_URL must be an HTTPS origin without a path, query, credentials, or fragment.");
  }
  return `${url.origin}/`;
}

export type PublicMetadataTag = { tag: "meta" | "link"; attrs: Record<string, string> };

export function publicMetadata(siteUrl: string | null): PublicMetadataTag[] {
  const meta = (key: "name" | "property", name: string, content: string): PublicMetadataTag => ({
    tag: "meta", attrs: { [key]: name, content, "data-public-metadata": "" },
  });
  return [
    meta("property", "og:type", "website"),
    meta("property", "og:site_name", "Neuebit"),
    meta("property", "og:title", LANDING_TITLE),
    meta("property", "og:description", LANDING_DESCRIPTION),
    meta("name", "twitter:card", siteUrl ? "summary_large_image" : "summary"),
    meta("name", "twitter:title", LANDING_TITLE),
    meta("name", "twitter:description", LANDING_DESCRIPTION),
    ...(siteUrl ? [
      { tag: "link" as const, attrs: { rel: "canonical", href: siteUrl, "data-public-metadata": "" } },
      meta("property", "og:url", siteUrl),
      meta("property", "og:image", `${siteUrl}social/neuebit-og.png`),
      meta("property", "og:image:type", "image/png"),
      meta("property", "og:image:width", "1200"),
      meta("property", "og:image:height", "630"),
      meta("property", "og:image:alt", SOCIAL_IMAGE_ALT),
      meta("name", "twitter:image", `${siteUrl}social/neuebit-og.png`),
      meta("name", "twitter:image:alt", SOCIAL_IMAGE_ALT),
    ] : []),
  ];
}
