---
title: "I Gave the AI a Browser and We Shipped the Redesign"
date: 2026-07-13
category: Projects
summary: "Once the development workflow could take its own screenshots, it found layout and font failures that every text-only check had missed."
---
I was tired of eyeballing every layout change, so I put Playwright + headless Chromium on my dev server. Full-page screenshots at a few viewports, every push. Caught stuff no text diff ever would.

First catch: my square-meter symbol. I'd used a raw `m²` character. On machines without the right font it rendered as tofu — empty box. Replaced it with proper semantic markup. Fixed everywhere.

## Stale CSS Made My Footer Icons Huge

Rebuilt the footer as clean cards. First load, the social SVGs blew up to viewport width. Browser was holding a cached stylesheet that predated the new SVG dimensions.

Two fixes, both dumb-obvious in hindsight: hardcode width/height right on the SVG tags so there's a baseline before CSS loads, and stick version query params on stylesheet links so updates actually invalidate client caches.

Moved the homelab links out of the header into the footer while I was in there. Header is for visitors now.

## The About Background Got Silly (in a Good Way)

About section now has a rotating server rack model over a canvas duotone of NASA's Blue Marble. Scroll position drives the rotation. Cloud layers for depth. Little patch-cable arcs from rack ports to map coordinates. Overkill? Yeah. I like it.

Homelab page stopped being text blocks, too. It's a ledger now — rack photo plus live numbers pulled from the Docker daemon by a pre-commit hook: 7 stacks, 27 containers, 39 images, 11 volumes, 12 networks. No hand-editing figures that rot.

Deployed to prod, checked desktop + mobile with clean cache. Shipped.
