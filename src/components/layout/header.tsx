import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SolutionsDropdown } from "@/components/layout/solutions-dropdown";
import { MobileMenu } from "@/components/layout/mobile-menu";

export function Header() {
  return (
    <header className="site-header site-header--glass">
      <Container className="header-frame">
        <div className="header-inner">
          <Link className="wordmark" href="/" aria-label="Picon Energies home">
            <Image
              src="/images/picon-logo-2.png"
              alt=""
              width={2172}
              height={724}
              sizes="(max-width: 650px) 128px, 158px"
              loading="eager"
              className="brand-logo"
            />
          </Link>

          <nav className="header-navigation" aria-label="Main navigation">
            <ul className="navigation-links">
              <SolutionsDropdown />
              <li>
                <Link className="navigation-link" href="/#ev-lite">
                  EV Lite
                </Link>
              </li>
              <li>
                <Link className="navigation-link" href="/about">
                  About
                </Link>
              </li>
              <li>
                <Link className="navigation-link" href="/#contact-frame">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>

          <div className="nav-actions">
            <Link className="header-cta" href="/contact?intent=enquiry">
              MAKE AN ENQUIRY <svg className="header-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
            </Link>
            <MobileMenu />
          </div>
        </div>
      </Container>
    </header>
  );
}
