# NeueBit mark

The SVG is a local, straight-edge trace of the supplied 1200 × 900 reference. The mark occupies approximately x=413–786.5 and y=257.9–631.6 in that image. The requested monochrome presentation uses black on light surfaces and white on dark surfaces.

The `374 × 374` viewBox trims the reference's presentation margins. A single even-odd path has a ten-vertex outer contour, a six-vertex diagonal opening, and a three-vertex lower-left cutout. The source's slight asymmetry is retained; coordinates are rounded to 0.1 source pixels. There are no strokes, raster elements, masks, effects, or color-filled holes. All sizes use identical geometry; 16px naturally has subpixel antialiasing on its thin right rail.

Use `NeuebitBrand` wherever the name and logo appear together. The standard lockup centers a 20px mark beside a 17px semibold wordmark with an 8px gap. The mark remains taller than the lettering, matching the proportions of the supplied monochrome lockup reference without inflating the text to the icon's height. `size` controls the mark height; text and spacing scale at the same ratio in every context. `wordmarkClassName="sidebar-label"` preserves collapsed-sidebar behavior. Chat replies use `size={16}` and `className="neuebit-brand--subtle"` for a smaller, medium-weight lockup in the theme's secondary text color. Use `NeuebitLogo` for standalone marks.

```tsx
import { NeuebitLogo } from "./components/brand/NeuebitLogo";

<NeuebitLogo size={24} title="NeueBit home" />
<NeuebitLogo size="2rem" decorative /> // Beside visible “NeueBit” text
<NeuebitLogo size={64} variant="dark" /> // Explicit dark surrounding surface
<NeuebitLogo size={40} variant="sage-surface" /> // Legacy surface variant, now a white tile
```

`size` defaults to 32 and accepts SVG/CSS lengths. Width/height utility classes can override it. `decorative` defaults to false; meaningful marks get a unique title association and `role="img"`. Decorative marks omit the title and use `aria-hidden`. Empty titles fall back to “NeueBit”.

| Variant | Presentation |
| --- | --- |
| `default` | Transparent; follows `--nb-logo-mark` and the app theme |
| `light` | Transparent; black mark for light surroundings |
| `dark` | Transparent; white mark for dark surroundings |
| `sage-surface` | Black mark on white; retained for API compatibility |

The light/dark names refer to the **surface**. Put spacing on the surrounding layout to preserve the requested mark dimensions. The simple large lockup uses existing Geist Sans rather than a new wordmark asset.

Global tokens live in `src/styles/theme.css`:

| Token | Value |
| --- | --- |
| `--nb-logo-on-light` | `#000000` — black |
| `--nb-logo-on-dark` | `#FFFFFF` — white |
| `--nb-logo-surface-light` | `#FFFFFF` — white |
| `--nb-logo-surface-dark` | `#111214` — existing dark panel |
| `--nb-logo-mark` | Light/dark alias selected by `data-theme` |

Black/white contrast is 21:1. Explicit variants stay stable when the page theme changes. To override the default mark in a local context, set `--nb-logo-mark` on a wrapper or the component's class.

`public/brand/neuebit-mark.svg` is the standalone transparent asset. Its CSS respects `prefers-color-scheme` when opened directly or embedded as an image. An external `<img>` cannot inherit a page's custom properties; use the React component for app theme control. The SVG's fill attribute provides a black fallback in renderers that ignore CSS.

`BrandMark`/`BrandEmblem` adapt existing app call sites to this component. The favicon is generated from the same raw SVG. Regenerate the favicon, touch icon, and social image with `node scripts/create-brand-assets.mjs` from `frontend`. Keep the raw SVG and the component path synchronized; the brand browser checks verify this.

Review `/brand` for fixed light/dark presentations, all six sizes, favicon/sidebar/header examples, and the large lockup. Run `npm run build` then `npx playwright test tests/brand tests/theme` for integration checks.
