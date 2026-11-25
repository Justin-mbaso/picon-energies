"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { solutionLinks } from "@/components/layout/site-links";

export function SolutionsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <li className="solutions-item" ref={rootRef}>
      <button
        className="navigation-link solutions-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-controls="solutions-dropdown"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
      >
        Solutions
        <span className={`solutions-chevron${isOpen ? " is-open" : ""}`} aria-hidden="true" />
      </button>
      <nav
        className={`solutions-dropdown${isOpen ? " is-open" : ""}`}
        id="solutions-dropdown"
        aria-label="Solutions"
        aria-hidden={!isOpen}
      >
        <ul className="solutions-menu-links">
          {solutionLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setIsOpen(false)}>
                {link.label}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </li>
  );
}
