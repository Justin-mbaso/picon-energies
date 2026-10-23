<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Picon Energies Project Rules

- **Facts:** Picon focuses on solar consultation and installation, energy storage and backup power, EV infrastructure and services, and the EV Lite ecosystem. Do not invent company scale, customers, capacity, locations, stations, partnerships, certifications, projects, testimonials, awards, team details, specifications, prices, warranties, or financing. Omit unavailable facts or use explicit placeholders.
- **Positioning:** Present Picon as a growing Nigerian energy company, not a multinational or an established nationwide charging network. EV maintenance and after-sales services are in development; EV Lite wallet, mobile app, and ecosystem features are future plans.
- **Stack:** Use the existing Next.js 16 App Router, TypeScript, Tailwind CSS 4, and ESLint setup. Avoid adding dependencies unless they solve a demonstrated need.
- **Components:** Keep reusable UI in `src/components/ui`, shared site chrome in `src/components/layout`, page sections in `src/components/sections`, and shared non-UI helpers in `src/lib`. Prefer small, focused server components and existing primitives; do not abstract prematurely.
- **Design:** Use centralized CSS variables/design tokens for color, type, spacing, radius, borders, and shadows. Keep the visual language premium, restrained, engineering-led, and approachable. Do not hard-code brand identity into individual components.
- **Assets:** Real brand assets and photography are not yet available. Use neutral, clearly temporary placeholders and structure components so genuine assets can replace them without a redesign. Do not use stock-like imagery or fabricate logos, product screens, or project visuals.
- **Accessibility:** Use semantic landmarks, descriptive link names, visible keyboard focus, sufficient contrast, and reduced-motion support. Interactive controls must work by keyboard and expose their purpose to assistive technology.
- **Responsive design:** Build mobile-first. Check narrow and wide layouts; prevent overflow, overlap, and text clipping.
