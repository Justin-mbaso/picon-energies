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
      <summary aria-label="Toggle navigation menu">MENU</summary>
      <nav aria-label="Mobile navigation">
        <ul>
          <li><Link href="/#capabilities">SOLUTIONS</Link></li>
          <li><Link href="/#ev-lite">EV LITE</Link></li>
          <li><Link href="/about">ABOUT</Link></li>
          <li><Link href="/#contact-frame">CONTACT</Link></li>
        </ul>
      </nav>
    </details>
  );
}
