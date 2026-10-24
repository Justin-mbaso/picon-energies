"use client";

import { useEffect } from "react";

const revealSelectors = [
  ".capabilities .capabilities-heading",
  ".capabilities .capability-tile",
  ".solar-section .solar-copy",
  ".solar-section .solar-visual",
  ".solar-section .solar-process-group",
  ".ev-infrastructure .solutions-heading",
  ".ev-infrastructure .solution-card",
  ".ev-infrastructure .mobility-line-areas > li",
  ".ev-lite .ev-lite-panel",
  ".ev-lite .ev-lite-visual",
  ".ev-lite .ev-lite-pillars > li",
  ".ev-lite-footer > .ev-lite-actions",
  ".ev-lite-footer > .ev-lite-note",
  ".solution-paths .solution-paths-heading",
  ".solution-paths .solution-path",
  ".contact-frame .contact-copy",
  ".contact-frame .contact-visual",
].join(",");

export function ScrollMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches || typeof window.IntersectionObserver !== "function") {
      return;
    }

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(revealSelectors),
    );

    if (targets.length === 0) return;

    const restoreVisibleContent = () => {
      root.classList.remove("has-scroll-motion");
      for (const target of targets) {
        target.classList.remove("motion-reveal", "motion-revealed");
      }
    };

    let observer: IntersectionObserver | null = null;

    try {
      for (const target of targets) {
        target.classList.add("motion-reveal");
      }
      root.classList.add("has-scroll-motion");

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;

            const target = entry.target as HTMLElement;
            target.classList.add("motion-revealed");
            observer?.unobserve(target);
          }
        },
        { rootMargin: "0px 0px -6% 0px", threshold: 0.12 },
      );

      for (const target of targets) {
        observer.observe(target);
      }
    } catch {
      observer?.disconnect();
      restoreVisibleContent();
      return;
    }

    return () => {
      observer?.disconnect();
      restoreVisibleContent();
    };
  }, []);

  return null;
}
