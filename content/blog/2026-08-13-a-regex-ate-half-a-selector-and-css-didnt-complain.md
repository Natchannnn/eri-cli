---
title: "Regex Selector Truncation and Animated Brand Integration"
date: 2026-08-13
category: Web
summary: "Integrating animated brand lockups, alpha-channel video fallbacks, layout radius tokens, and diagnosing a silent CSS selector truncation caused by regex deletion."
---
Front-end updates across the portfolio and lab sites focused on integrating animated brand assets, alpha-channel video fallbacks, and design token refinements, concluding with a layout fix caused by an accidental CSS selector truncation.

Handling new video and vector assets required adapting to format constraints: H.264 lacks alpha transparency, frame interpolation introduces artifacts on sharp vector wipes, and regex pattern matching without strict boundary assertions can truncate CSS selectors.

## Processing wordmark and monogram assets

Source wordmark videos ("ERIC LI" and "N5HQ") were delivered as 1440×1440 renders with roughly 80% empty margins. Bounding box analysis measured the active artwork at 942×294 within the canvas, requiring an automated crop to isolate active content.

A 1:1 square monogram resolved favicon rendering constraints where the 3:1 aspect ratio wordmark illegibly collapsed at 16px. Traced to a 1.5 KB SVG, the monogram served as both `favicon.svg` and a lightweight fallback without requiring markup revisions.

Combined lockups were delivered with embedded entry and exit sequences. Frame-difference analysis separated the assets into four distinct clips: entry, exit, hover-in, and hover-out. Inspecting rest frames also caught two mislabeled assets containing legacy text, preventing incorrect branding from reaching the lab site.

## Evaluating animation timing and frame rates

Extending a 0.65-second reveal sequence to 1.5 seconds at 30 fps was evaluated across three rendering strategies:
1. Motion-compensated interpolation generated visible block artifacts along sharp vector edges.
2. Frame blending introduced ghosting smears during transitions.
3. Direct frame duplication preserved sharp graphic boundaries without distortion.

Because vector wipes transition via binary state changes rather than continuous camera movement, frame duplication produced the cleanest result.

## Design token alignment and border radius normalization

The navigation bar styling transitioned from a full pill to a 3px rounded rectangle, prompting an audit of site-wide border radii:
- Updating `--r-pill: 99rem` to `3px` adjusted navigation containers, buttons, chips, eyebrow tags, and status badges in a single token update.
- Circular elements hardcoded at `50%` (mobile menu trigger, social links, button arrow discs) were updated explicitly.
- Functional indicators (status LEDs, active navigation dots, and decorative background orbs) remained circular at `50%` to preserve visual hierarchy.

## Responsive navigation condensation

Initial scroll behavior animated the logo out while leaving the navigation container expanded, producing an unnatural empty bar. This was revised to condense the navigation bar dynamically: past the hero section, the bar shrinks to wrap its contents, standardizing the gap between the logo lockup and adjacent links to 26px.

Because CSS cannot smoothly transition from `max-width` to `max-content`, the condensed width is measured dynamically and stored in a CSS custom property to enable smooth transitions, reinforced with 90px of scroll hysteresis to eliminate edge jitter.

## Alpha transparency and video encoding

Generating transparent video overlays from dark renders required color separation rather than simple threshold keying, which leaves jagged boundary artifacts. The alpha channel was solved mathematically per pixel against known foreground tones:
$$p = a \cdot F$$
Recompositing over black confirmed a mean error of 0.04 across the dataset.

Because MP4 does not support alpha transparency, assets were encoded into VP9 WebM for Chrome, Firefox, and Edge, with opaque fallbacks provided for browsers lacking VP9 alpha decode support.

## Debugging silent CSS selector truncation

During cleanup of legacy contact markup, unused social icon styles were targeted with a regex pattern matching `.social-icon{`. One rule in the stylesheet was defined as:
```css
.cta .social-icon{color:var(--grey)}
```
The regex matched from `.social-icon{` onward and deleted the declaration, leaving `.cta` as an orphaned selector on the preceding line.

Because CSS parsers discard whitespace and comments, the orphaned selector bound directly to the subsequent declaration:
```css
.cta .mock{...}
```
This converted `.mock` into a descendant selector matching non-existent markup. Consequently, the hero dashboard mockup lost its `max-width`, negative margins, and stacking context, expanding full-bleed across the screen.

The resulting stylesheet was valid CSS, allowing build pipelines and git commits to pass without diagnostic warnings. The defect was identified during visual regression review and fixed by removing the orphan selector, verified by inspecting the computed `max-width` (928px).

Before pushing updates, repository remotes were migrated from the retired bare repository on pve01 to the active Forgejo instance on pve02, ensuring deployment webhooks triggered correctly.

The asset pass successfully integrated transparent WebM animations, consolidated border radii to the 3px token across UI chrome, and dynamic condensed nav sizing. Diagnosing the broken hero mockup emphasized the danger of regex-based stylesheet cleanups: leaving an orphaned selector preamble created valid syntax that quietly unbound hero styling, caught and verified by checking computed CSS layout metrics.
