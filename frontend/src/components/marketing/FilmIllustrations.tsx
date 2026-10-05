import { m } from "framer-motion";

const ease: [number, number, number, number] = [.22, 1, .36, 1];

// Supplied artwork, cropped and exported without redrawing or recoloring.
// Each figure owns its layer; the reader sits behind the opaque product frame.
export function FilmIllustrations({ reduced }: { reduced: boolean }) {
  return <div className="film-illustrations" aria-hidden="true">
    <m.span className="film-artwork film-reader"
      initial={reduced ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduced ? 0 : .5, delay: reduced ? 0 : .35, ease }}>
      <img src="/illustrations/product-film/reader-peek.png" width={418} height={963}
        alt="" draggable={false} decoding="async" loading="lazy" />
    </m.span>
    <m.span className="film-artwork film-observer"
      initial={reduced ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : .5, delay: reduced ? 0 : .35, ease }}>
      <img src="/illustrations/product-film/observer-magnifier.png" width={1128} height={744}
        alt="" draggable={false} decoding="async" loading="lazy" />
    </m.span>
  </div>;
}
