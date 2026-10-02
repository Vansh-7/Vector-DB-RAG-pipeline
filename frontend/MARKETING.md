# Neuebit marketing foundation

This is the public site's design system. The dark workspace and auth form keep the product rules in [DESIGN.md](DESIGN.md). The approved direction is minimal, editorial, light first, and product led. Neuebit's existing duck mark and Geist fonts carry the personality; the foundation uses no decorative accent.

## Palette

| Token suffix (`--marketing-`) | Value | Role |
| --- | --- | --- |
| `background-main` | `#faf9f6` | Warm off-white page |
| `background-subtle` | `#f2f1ec` | Quiet section/surface variation |
| `surface` | `#ffffff` | Product image framing |
| `text-primary`, `brand-ink` | `#23231f` | Main text and primary CTA |
| `text-secondary` | `#63635c` | Supporting copy |
| `text-muted` | `#6d6d65` | Small supporting information |
| `brand-cream` | `#f3f0e6` | Text on an ink button; existing mark |
| `border` | `#e4e3dc` | Decorative separators and frames |
| `border-strong` | `#b8b8ae` | Hover emphasis |
| `focus` | `#23231f` | Keyboard focus, 2px with 4px offset |
| `action-hover` / `action-active` | `#3b3b34` / `#161613` | Primary CTA feedback |
| `technical-background` / `technical-surface` | `#171817` / `#20211f` | Future contained Vector Lab section |
| `technical-text` / `technical-secondary` | `#f3f0e6` / `#b3b3a9` | Technical section copy |
| `technical-border` | Ivory at 12% | Technical separators |

Keep all colors warm neutral. Body, supporting copy, and CTA text must pass 4.5:1 contrast. Faint borders are decorative; they are not the sole indicator of an operable control. Technical colors are reserved for the later Vector Lab section, not a second site-wide theme.

## Type, spacing, and framing

Use the existing local Geist Sans files; Geist Mono is reserved for architecture labels and actual engine data. No additional font files or remote font requests.

- Display: 44–84px via `clamp`, weight 600, line height 1.04, tracking −0.045em.
- Section heading token: 32–52px. Lead copy: 17–20px with 1.65 line height. Body: 16px; small supporting copy: 14px.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, and 128px. Use the shared variables rather than new one-off values for normal spacing.
- Container: maximum 1280px including gutters. Gutters scale from 20 to 64px; section padding from 64 to 128px. Text uses narrower line lengths within this grid.
- Radii: buttons 6px, surfaces 12px, future product frames 14px. Frames use a 1px quiet border; the optional preview shadow is `0 18px 48px rgba(35, 35, 31, .08)`.
- Buttons are at least 44px high, wrap safely, and use a 180ms color/border transition with `cubic-bezier(0.22, 1, 0.36, 1)`. Reduced motion removes that transition. The base page has no entrance or idle animation.

## Ownership and Phase B scope

`src/styles/marketing-tokens.css` supplies the small shared token layer and public document surface. Its styles activate under `.marketing-page` or `html[data-page-surface="marketing"]`. It never changes the product's `:root` palette. `App.tsx` sets the route marker before paint: `/auth` and `/app` use the product surface; public pages use marketing. Public pages have normal document scrolling; auth/app retain the existing viewport-contained layout.

`src/styles/marketing.css` supplies the base container, section spacing, display/lead typography, and buttons. It is imported only by the lazy LandingPage chunk. All selectors have the marketing prefix so the stylesheet can remain loaded after navigation without changing the workspace.

Phase B applies this foundation to the existing entry copy and CTAs. Full navigation, final hero composition/copy, real product previews, section storytelling, footer, and entrance motion belong to their later phases. Preview radius/shadow and technical palette are tokens for those phases; no fake product imagery or technical blocks are rendered here.

## Review

Review the base page at 320/375px, 768px, 1024/1280px, and 1440px. Check the copy at 200% text size, keyboard focus, reduced motion, and normal document scrolling. Navigate from the public page to auth/app and back to ensure palette, overflow, and color-scheme ownership restore correctly. The marketing browser suite captures desktop and mobile base-page images for visual review.
