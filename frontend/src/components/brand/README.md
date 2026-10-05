# NeueBit brand components and assets

The current public name is **NeueBit**. Use the geometric N mark and the shared wordmark lockup; internal names such as `NeuebitLogo`, `NeuebitBrand` and lowercase asset filenames remain unchanged.

## Geometry and theme

The mark is a local straight-edge trace of the supplied 1200×900 reference, retaining its slight asymmetry. The 374×374 viewBox trims presentation margins. One even-odd path forms the outer contour, diagonal opening and lower-left cutout, with no strokes, raster elements, masks or colored holes. All sizes share the same geometry.

[NeuebitLogo.tsx](NeuebitLogo.tsx) provides the theme-aware standalone mark. `size` defaults to 32 and accepts a number or CSS/SVG length; width/height utility classes can override it. Put surrounding spacing on the layout rather than changing the mark geometry.

| Variant | Presentation |
| --- | --- |
| `default` | Transparent; follows `--nb-logo-mark` and the page theme |
| `light` | Transparent black mark for light surroundings |
| `dark` | Transparent white mark for dark surroundings |
| `sage-surface` | Black mark on a white tile; retained for API compatibility |

Variant names describe the surrounding surface. Global `--nb-logo-*` tokens live in [theme.css](../../styles/theme.css); the default resolves to black in light mode and white in dark mode. Explicit variants stay stable across theme changes. A wrapper can override `--nb-logo-mark` for a local context.

## Wordmark and accessibility

[NeuebitBrand.tsx](NeuebitBrand.tsx) combines the decorative mark and visible NeueBit text. Its default 20px mark, 17px semibold Geist Sans wordmark and 8px gap scale proportionally through `size`. `wordmarkClassName="sidebar-label"` supports the collapsed sidebar. Chat replies use `size={16}` and `neuebit-brand--subtle` for the secondary-text lockup. Existing `BrandMark`/`BrandEmblem` wrappers adapt older call sites to the same mark.

Example usage after importing the components from this directory:

```tsx
<NeuebitBrand size={24} />
<NeuebitLogo size={24} title="NeueBit home" />
<NeuebitLogo size="2rem" decorative />
<NeuebitLogo size={64} variant="dark" />
```

`decorative` defaults to false. Meaningful standalone marks use `role="img"` with a unique title association; an empty title falls back to NeueBit. Beside visible brand text, use a decorative mark so the name is not repeated. The combined lockup handles this itself.

## Favicon, touch and social assets

[public/brand/neuebit-mark.svg](../../../public/brand/neuebit-mark.svg) is the transparent raw asset and the **active favicon** referenced by `index.html`. Its CSS follows browser `prefers-color-scheme`. An external SVG image cannot inherit the app's custom properties; use the React component when the app's explicit theme must control it.

The generated `public/favicon.svg` is a matching copy of that raw mark. The 180×180 `public/apple-touch-icon.png` places it on white. The 1200×630 `public/social/neuebit-og.png` combines the mark, NeueBit wordmark and authored product positioning. Social metadata configuration belongs to the [frontend README](../../../README.md#production-hosting-target-and-handoff).

Regenerate these exports from `frontend/` using the existing script:

```bash
node scripts/create-brand-assets.mjs
```

The script uses installed Google Chrome, the local raw SVG and local Geist font. It regenerates the favicon copy, touch icon and social image; it does not redraw the mark or regenerate product-film illustrations. Keep the raw SVG path and React geometry synchronized.

The public `/brand` reference page shows explicit light/dark variants, size previews and lockup examples. Integration coverage lives in `tests/brand` and `tests/theme`. Run `npm run build`, then `npx playwright test tests/brand tests/theme` using the [current browser configuration](../../../README.md#build-and-checks).
