---
title: "Automating Frontend Visual Verification with Headless Chromium"
date: 2026-07-13
category: Projects
summary: "Integrating Playwright and headless Chromium into the development workflow to catch layout bugs, font rendering issues, and responsive stylesheet regressions."
---
Iterating on website layout and responsive design manually created an inspection bottleneck during rapid development. To eliminate guesswork, Playwright and headless Chromium were deployed on the development server, allowing automated full-page screenshot capture across various viewport dimensions.

The automated visual tests immediately caught an issue invisible in text diffs: an exotic Unicode character used for the square meter symbol (`m²`) failed to render, displaying an empty tofu glyph for clients without specialized fonts installed. Replacing the symbol with standard semantic markup resolved the rendering bug across all browsers.

## Stylesheet Caching and Component Sizing

Rebuilding the footer layout to follow a clean card structure revealed a caching pitfall. On initial load, social media icons rendered at viewport width because the browser retained an earlier cached stylesheet that lacked explicit dimensions for new SVG elements.

The issue was resolved with two measures:
1. Declaring hardcoded width and height attributes directly on SVG markup to guarantee baseline sizing before styles load.
2. Adding asset version query parameters to stylesheet links to invalidate stale client caches on updates.

During this pass, internal homelab navigation links were moved out of the primary header and placed into the footer to reserve the main navigation for visitors.

## Visual Design and Interactive Scenes

The About section background was updated with a dynamic 3D scene: a rotating server rack model paired with a canvas-rendered duotone projection of NASA's Blue Marble map. The scene maps real-time scroll position to axial rotation, using layered cloud textures to give depth to the sphere. Patch cable arcs connect rack port nodes to geographic coordinates on the globe surface.

## Homelab Metrics Automation

The homelab overview page was transitioned from generic text blocks to an infrastructure ledger. The page displays a hardware rack photograph alongside live metrics: 7 Compose stacks, 27 running containers, 39 images, 11 volumes, and 12 networks. These statistics are queried directly from the local Docker daemon by an automated pre-commit hook, ensuring published figures match production deployments without manual data entry.

The updated design was deployed to production and verified across desktop and mobile viewports with clean cache invalidation.
