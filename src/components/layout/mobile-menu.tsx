"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export function MobileMenu() {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeWhenClickingOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeWhenClickingOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details className="mobile-menu" ref={menuRef}>
      <summary aria-label="Toggle navigation menu"><span className="menu-lines" aria-hidden="true" /></summary>
      <nav aria-label="Mobile navigation" onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a") && menuRef.current) {
          menuRef.current.open = false;
        }
      }}>
        <ul>
          <li><Link href="/#capabilities">Solutions</Link></li>
          <li><Link href="/#ev-lite">EV Lite</Link></li>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/#contact-frame">Contact</Link></li>
        </ul>
      </nav>
    </details>
  );
}
