---
title: "Editorial and Card Layout Revisions for the Portfolio"
date: 2026-06-13
category: Projects
summary: "Eliminating generic buzzwords from the About section, replacing non-interactive pill elements with anchor jumps, and implementing native HTML details elements for project cards."
---
Auditing the portfolio copy and project layout on the local staging environment (port 3002) eliminated inflated claims and replaced dense card layouts with native collapsible elements.

## Removing Generic Buzzwords

The original About copy defaulted to common boilerplate ("passionate full-stack developer with deep expertise in building scalable solutions"). This language failed to communicate verifiable technical competence.

The copy was refactored to emphasize actual systems:
- Documenting the physical homelab environment: five isolated VLANs, over twenty active containers, and continuous observability dashboards.
- Framing career progression directly toward networking and infrastructure engineering.
- Updating the site title and hero designation to "Full-Stack & Infrastructure" to reflect both software projects and operational systems.
- Replacing vague marketing headers with direct descriptions ("Work that ships and runs").

## Interactive Navigation and Anchor Links

Under the Portfolio heading, three static pill badges (Completed, In Progress, Upcoming) had been styled like buttons but lacked interactivity. These elements were converted into functional anchor links targeting the corresponding project groupings, calculating offset margins to clear the fixed navigation bar.

## Native Expandable Project Cards

The project showcase previously displayed full technical specifications, paragraphs of narrative, and dependency tags simultaneously, creating excessive vertical scroll.

To improve scannability, the cards were refactored using native HTML `<details>` and `<summary>` elements:
- By default, each card displays only the project title, a single-sentence overview, and a styled "Details" trigger.
- Expanding the trigger reveals full architecture breakdowns, metrics, and technology tags without requiring client-side JavaScript.
- Default browser disclosure triangles were hidden via `summary::-webkit-details-marker { display: none; }` and `summary { list-style: none; }`, replaced with custom CSS indicators that rotate dynamically on toggle.

## Staging Status

All revisions remain staged on the local development environment for cross-browser inspection prior to triggering production Vercel builds.

## Pending Verification

- Verify native `<details>` keyboard accessibility across Chromium, WebKit, and Gecko engines.
- Test mobile touch responsiveness on disclosure toggles.
