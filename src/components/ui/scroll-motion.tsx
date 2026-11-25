"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const contentSelectors = [
  ".capabilities-heading", ".capability-tile", ".solar-copy",
  ".solutions-heading", ".solution-card", ".mobility-line-areas > li",
  ".ev-lite-panel", ".ev-lite-pillars > li", ".ev-lite-actions", ".ev-lite-note",
  ".solution-paths-heading", ".solution-path", ".contact-copy",
].join(",");
const imageSelectors = ".solar-visual,.ev-lite-visual,.contact-visual";
const motionQuery = "(prefers-reduced-motion: reduce)";
const energyPath = "M5 35H200l30-22h110l30 44h85l30-22h170";

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function ScrollMotion() {
  const lineRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(motionQuery).matches,
    () => true,
  );

  useEffect(() => {
    const line = lineRef.current;
    if (!line || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(([entry]) => {
      line.toggleAttribute("data-inview", entry.isIntersecting);
    });
    observer.observe(line);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("#main-content");
    if (!root) return;
    const html = document.documentElement;
    html.toggleAttribute("data-effects-paused", paused || reduced);
    let cancelled = false;
    let revert = () => {};

    // Default CSS stays visible; a failed import or setup restores the original page.
    if (!paused && !reduced) {
      Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        const targets = root.querySelectorAll<HTMLElement>(`${contentSelectors},${imageSelectors},.solar-process-group`);
        revert = () => {
          media.revert();
          targets.forEach((element) => element.classList.remove("approved-reveal"));
        };
        try {
          targets.forEach((element) => element.classList.add("approved-reveal"));
          media.add({ wide: "(min-width: 1001px)", compact: "(max-width: 1000px)" }, (context) => {
            const wide = context.conditions?.wide;
            const belowFold = (element: HTMLElement) => element.getBoundingClientRect().top >= innerHeight * .92;
            root.querySelectorAll<HTMLElement>(contentSelectors).forEach((element) => {
              if (!belowFold(element)) return;
              gsap.fromTo(element, { opacity: 0, y: wide ? 34 : 18 }, {
                opacity: 1, y: 0, duration: .8, ease: "power3.out", clearProps: "opacity,transform",
                scrollTrigger: { trigger: element, start: "top 91%", once: true },
              });
            });
            root.querySelectorAll<HTMLElement>(imageSelectors).forEach((element) => {
              if (!belowFold(element)) return;
              gsap.fromTo(element, { opacity: 0, y: wide ? 38 : 15, clipPath: "inset(10% 0% 10% 0% round 18px)" }, {
                opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0% round 18px)", duration: 1.1, ease: "power3.out", clearProps: "opacity,transform,clipPath",
                scrollTrigger: { trigger: element, start: "top 92%", once: true },
              });
            });
            gsap.fromTo(root.querySelectorAll(".solar-process-group"), { opacity: 0, y: 24 }, {
              opacity: 1, y: 0, stagger: .12, duration: .65, ease: "power3.out", clearProps: "opacity,transform",
              scrollTrigger: { trigger: root.querySelector(".solar-process-list"), start: "top 88%", once: true },
            });
          }, root);
          document.fonts.ready.then(() => { if (!cancelled) ScrollTrigger.refresh(); });
          setReady(true);
        } catch {
          revert();
          setReady(false);
        }
      }).catch(() => { if (!cancelled) setReady(false); });
    }

    return () => {
      cancelled = true;
      revert();
      html.removeAttribute("data-effects-paused");
    };
  }, [paused, reduced]);

  const label = reduced ? "Reduced motion enabled" : paused ? "Resume animations" : "Pause animations";
  return (
    <div className={`energy-connection${ready && !paused && !reduced ? " is-enabled" : ""}`} ref={lineRef}>
      <svg viewBox="0 0 660 70" aria-hidden="true">
        <path className="energy-route" d={energyPath} />
        <circle cx="6" cy="35" r="4" /><circle cx="330" cy="13" r="4" /><circle cx="654" cy="35" r="4" />
        <path className="energy-flow" d={energyPath} />
      </svg>
      <button className="motion-toggle" type="button" aria-label={label} aria-pressed={paused || reduced} hidden={!ready} disabled={reduced} onClick={() => setPaused((value) => !value)}>
        <span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span>
        <span className="motion-sr-only">{label}</span>
      </button>
    </div>
  );
}
