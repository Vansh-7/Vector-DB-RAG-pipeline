import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "../theme/themeContext";
import { heroFilmChapters, type HeroFilmScene } from "./heroFilmTimings";
import "../../styles/marketing-film.css";

const mobileMedia = window.matchMedia("(max-width: 767px)");
const readMobile = () => mobileMedia.matches;
const subscribeMobile = (notify: () => void) => {
  mobileMedia.addEventListener("change", notify);
  return () => mobileMedia.removeEventListener("change", notify);
};

// Only media assets cross this boundary. The real app is recorded in a separate
// development process; its shell, query clients and vector renderer stay private.
export function HeroProductFilm({ reduced }: {
  reduced: boolean;
}) {
  const { theme } = useTheme();
  const mobile = useSyncExternalStore(subscribeMobile, readMobile);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [playing, setPlaying] = useState(false);
  const [scene, setScene] = useState<HeroFilmScene>("documents");
  const variant = `${mobile ? "mobile" : "desktop"}-${theme}` as keyof typeof heroFilmChapters;
  const asset = `/product/film/neuebit-${variant}`;
  const shouldPlay = !reduced && inView && visible;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .08 });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (shouldPlay) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }, [shouldPlay, asset]);

  function syncScene(time: number) {
    // Scene metadata follows the real recording, including seeks and looping.
    const chapter = heroFilmChapters[variant].findLast(chapter => time >= chapter.start) ?? heroFilmChapters[variant][0];
    setScene(chapter.scene);
  }

  return <div ref={root} className="product-film" data-scene={scene} data-presentation={playing ? "playing" : reduced ? "complete" : "paused"}>
    <div className="film-screen">
      <video key={asset} ref={video} className="film-video" poster={`${asset}.webp`}
        src={reduced ? undefined : `${asset}.mp4`}
        width={mobile ? 390 : 1280} height={722}
        autoPlay={shouldPlay} muted loop playsInline preload={reduced ? "none" : "metadata"}
        aria-label="Neuebit product film" aria-describedby="hero-film-description"
        onLoadedMetadata={() => syncScene(0)} onTimeUpdate={event => syncScene(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}>
        Explore Neuebit’s Documents, Search, Chat, sources and Vector Lab in the product stories below.
      </video>
    </div>
    <p id="hero-film-description" className="sr-only">An actual Neuebit workspace recorded with illustrative sample documents: Documents, semantic search, Chat, two answer sources, and Vector Lab. Explore these features in the interactive sections below.</p>
  </div>;
}
