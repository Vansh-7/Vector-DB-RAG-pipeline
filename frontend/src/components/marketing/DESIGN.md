# NeueBit marketing component rules

This file covers implementation ownership and constraints within the public marketing subtree. [MARKETING.md](../../../MARKETING.md) owns the current section order, content, examples and film workflow. [README.md](../../../README.md) owns commands, routes, auth and deployment handoff. The authenticated product contract is [DESIGN.md](../../../DESIGN.md).

## Component ownership

| File | Responsibility |
| --- | --- |
| `LandingNav`, `LandingHero`, `CapabilityMarquee` | Public navigation, centered capability headline and moving capability strip |
| `HeroProductFilm`, `FilmIllustrations`, `heroFilmTimings` | Static-media playback/fallback, approved perimeter artwork and encoded scene metadata |
| `KnowledgeStories` | Documents/Search pair, wide saved Chat/source example and discovery links |
| `ProductTour`, `useRetrievalStory` | Three-zone retrieval explanation, sticky eligibility, progression and technical handoff |
| `EngineeringSection`, `demo/DemoVectorLab` | Local vector illustration/inspector and technical chapter |
| `ArchitecturePipeline`, `useArchitectureSequence` | Inspectable question stages and pause/resume lifecycle |
| `FinalCTA`, `LandingFooter` | Closing account/GitHub actions and local navigation |

Public example data lives in `demo/demoContent.ts`. Examples use local React state and authored fixtures; they do not mount AppShell, product queries or D3. The hero imports static media, not authenticated components. Entry-level session restoration is separate from marketing examples.

## Tokens and layout boundaries

[theme.css](../../styles/theme.css) owns semantic colors and brand tokens. [marketing-tokens.css](../../styles/marketing-tokens.css) owns composition, Geist typography, gutters, radii and three section-gap tiers:

| Token | Current responsive value |
| --- | --- |
| `--marketing-gap-continuation` | `clamp(4.5rem, 6.5vw, 6.5rem)` |
| `--marketing-gap-section` | `clamp(6.5rem, 10vw, 9.5rem)` |
| `--marketing-gap-chapter` | `clamp(8rem, 13vw, 12.5rem)` |

The incoming section normally owns the gap. Film perimeter bounds, discovery-to-story separation, sticky release and the closing CTA have deliberate boundary exceptions. Do not stack neighboring arbitrary margins/padding or shorten scroll duration to normalize whitespace.

[marketing.css](../../styles/marketing.css) owns the hero/navigation and knowledge/discovery composition; [marketing-film.css](../../styles/marketing-film.css) owns the approved media frame and illustration layering. [marketing-tour.css](../../styles/marketing-tour.css), [marketing-engineering.css](../../styles/marketing-engineering.css), [marketing-narrative.css](../../styles/marketing-narrative.css) and [marketing-footer.css](../../styles/marketing-footer.css) own their respective chapter/presentation boundaries.

Capability accents use the existing `--capability-*-ink/soft/mark` roles and theme overrides. Conversion actions keep their existing blue treatment. Use the geometric N and NeueBit wordmark; internal component/asset names retain their established casing.

The observer sits above/right of the frame; the reader sits behind its opaque left edge. Preserve the exact PNGs, sizing and layers. CSS hides both in dark mode and below 1200px. Illustrations remain outside captured film pixels.

## Motion ownership

Framer Motion is confined to public presentation chunks. Keep the existing easing and bounded transforms; CSS owns marquee/discovery feedback. Do not add animation dependencies or a second global timeline.

- Headline cycling and film playback suspend when offscreen or the document is hidden; reduced motion fixes the phrase and uses the poster.
- `usePresentation` advances saved Search/Chat content through finite phases. Hidden/offscreen time is excluded, interaction interrupts presentation, and unmount cleans timers.
- `useRetrievalStory` measures heading/canvas fit below the header using resize observers. Only eligible desktop uses the 240svh sticky section and scroll-linked reveal/release. The completed story fades into the technical grid/gradient; complete content remains available in fallback layouts.
- `useArchitectureSequence` advances inspectable stages only while visible. Manual selection pauses it; pause/resume is explicit. Reduced motion retains manual stages without autoplay.
- The marquee exposes pause/resume and stops under reduced motion. Decorative illustrations and discovery feedback retain their existing reduced-motion behavior.

Do not describe saved public examples as live generation. The product film's streaming behavior comes from capture-only chunked API fixtures, not the landing runtime.

## Responsive and accessible behavior

Use available content width and measured fit rather than forcing desktop scenes onto mobile. Keep knowledge windows complete, vector inspector below the map when needed, wrapped architecture controls and non-sticky retrieval fallback. Preserve enlarged-text behavior and absence of horizontal page overflow.

Retain heading/region labels, pressed/selected states, source disclosure controls, local-anchor focus, keyboard-visible focus and native point selection. Decorative SVG/PNG artwork stays hidden from assistive technology; inactive headline phrases are not announced.

Relevant tests remain in [tests/marketing](../../../tests/marketing), with entry, theme, brand and authenticated source-handoff coverage in their existing suites. Test names such as `guided-tour.spec.ts` are historical identifiers for current coverage, not evidence of retired tab controls. Review the complete page in both themes and responsive/reduced-motion layouts before changing these contracts.
