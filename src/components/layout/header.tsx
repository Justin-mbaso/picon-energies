import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SolutionsDropdown } from "@/components/layout/solutions-dropdown";
import { MobileMenu } from "@/components/layout/mobile-menu";

export function Header() {
  return (
    <header className="site-header">
      <Container>
        <div className="header-inner">
          <Link className="wordmark" href="/" aria-label="Picon Energies home">
            <Image
              src="/images/picon-logo.png"
              alt=""
              width={186}
              height={54}
              priority
              className="brand-logo header-logo-light"
            />
            <Image
              src="/images/picon-logo-2.png"
              alt=""
              width={186}
              height={54}
              priority
              className="brand-logo header-logo-dark"
            />
          </Link>

          <nav className="header-navigation" aria-label="Main navigation">
            <ul className="navigation-links">
              <SolutionsDropdown />
              <li>
                <Link className="navigation-link" href="/#ev-lite">
                  EV LITE
                </Link>
              </li>
              <li>
                <Link className="navigation-link" href="/about">
                  ABOUT
                </Link>
              </li>
              <li>
                <Link className="navigation-link" href="/#contact-frame">
                  CONTACT
                </Link>
              </li>
            </ul>
          </nav>

          <MobileMenu />

          <Link className="header-cta" href="/contact?intent=enquiry">
            MAKE AN ENQUIRY <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Container>
    </header>
  );
}
