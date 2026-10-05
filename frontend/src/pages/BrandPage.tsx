import { Link } from "react-router-dom";
import { NeuebitLogo } from "../components/brand/NeuebitLogo";
import { NeuebitBrand } from "../components/brand/NeuebitBrand";
import { ThemeToggle } from "../components/theme/ThemeToggle";
import "../styles/brand-showcase.css";

const sizes = [16, 24, 32, 40, 64, 128] as const;

export default function BrandPage() {
  return (
    <main className="brand-showcase">
      <header className="brand-showcase__header">
        <Link to="/" className="brand-showcase__home"><NeuebitBrand /></Link>
        <ThemeToggle />
      </header>
      <h1 tabIndex={-1}>The NeueBit mark</h1>
      <p className="brand-showcase__intro">One geometry, across every surface and scale.</p>

      <div className="brand-showcase__presentations">
        <figure className="brand-showcase__presentation brand-showcase__presentation--light">
          <NeuebitLogo size={128} variant="light" title="NeueBit on white" />
          <figcaption>Black on white</figcaption>
        </figure>
        <figure className="brand-showcase__presentation brand-showcase__presentation--dark">
          <NeuebitLogo size={128} variant="dark" title="NeueBit on charcoal" />
          <figcaption>White on charcoal</figcaption>
        </figure>
      </div>

      <section className="brand-showcase__section" aria-labelledby="brand-scale">
        <h2 id="brand-scale">At every size</h2>
        {(["light", "dark"] as const).map((variant) => (
          <div key={variant} className={`brand-showcase__sizes brand-showcase__sizes--${variant}`} aria-label={`${variant} size samples`}>
            {sizes.map((size) => <figure key={size}>
              <div className="brand-showcase__size-mark"><NeuebitLogo size={size} variant={variant} decorative /></div>
              <figcaption>{size} × {size}</figcaption>
            </figure>)}
          </div>
        ))}
      </section>

      <section className="brand-showcase__section" aria-labelledby="brand-in-use">
        <h2 id="brand-in-use">In the product</h2>
        <div className="brand-showcase__contexts">
          <figure><div className="brand-showcase__browser-tab"><NeuebitBrand size={16} /><span>— Workspace</span></div><figcaption>Favicon · 16 px</figcaption></figure>
          <figure><div className="brand-showcase__sidebar"><NeuebitBrand /></div><figcaption>Sidebar · 20 px</figcaption></figure>
          <figure><div className="brand-showcase__app-header"><NeuebitBrand /></div><figcaption>App header · 20 px</figcaption></figure>
        </div>
        <figure className="brand-showcase__lockup">
          <div><NeuebitBrand size="clamp(36px, 7vw, 88px)" /></div>
          <figcaption>Brand lockup · Geist Sans</figcaption>
        </figure>
      </section>

      <footer className="brand-showcase__footer">
        <a href="/brand/neuebit-mark.svg" download="neuebit-mark.svg">Download SVG</a>
        <span>Transparent SVG · Theme-aware color</span>
      </footer>
    </main>
  );
}
