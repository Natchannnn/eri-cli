---
title: "A Regex Ate Half a Selector and CSS Didn't Complain"
date: 2026-08-13
category: Web
summary: "A cleanup regex removed half a selector without producing invalid CSS. The build stayed green while the hero quietly broke."
---
Front-end day across portfolio + lab: animated brand assets, alpha video fallbacks, token cleanup. Ended with a broken hero caused by my own regex. CSS said nothing. Builds passed. Of course.

## Brand Assets In

Wordmark videos ("ERIC LI", "N5HQ") arrived 1440×1440 with ~80% empty margin. Bbox measured live art at 942×294 — auto-cropped.

3:1 wordmark collapses to mush at 16px favicon, so I traced a 1:1 monogram (1.5 KB SVG) doubling as `favicon.svg` + lightweight fallback. No markup changes needed.

Lockups shipped with embedded in/out sequences. Frame-diffing split them into entry, exit, hover-in, hover-out. Rest-frame inspection caught two mislabeled assets with legacy text — would've shipped wrong branding to the lab site.

## Timing: Duplication Beat Interpolation

Stretching the 0.65s reveal to 1.5s at 30fps, three options tested: motion-compensated interpolation (block artifacts on sharp vector edges), frame blending (ghost smears), plain frame duplication. Vector wipes are binary state changes, not camera motion — duplication won, sharp boundaries intact.

## One Token to Round Them

Nav went full-pill → 3px rounded rect, so I audited every radius: `--r-pill: 99rem` → `3px` swept nav containers, buttons, chips, eyebrows, badges in one update. True circles hardcoded `50%` (menu trigger, socials, arrow discs) updated by hand. Status LEDs, nav dots, bg orbs stay `50%` — functional indicators keep their hierarchy.

Scroll behavior v1 animated the logo away leaving a fat empty bar. Reworked: past hero, the bar condenses to wrap contents, logo-to-link gap standardized 26px. CSS can't transition `max-width` → `max-content`, so I measure the condensed width into a custom property at runtime + 90px scroll hysteresis against edge jitter.

Alpha overlays from dark renders: threshold keying leaves jagged edges. Solved per-pixel against known foreground tones ($$p = a \cdot F$$), recomposite-over-black mean error 0.04. MP4 can't carry alpha — VP9 WebM for Chrome/FF/Edge, opaque fallbacks elsewhere.

## The Regex

Cleaning dead contact markup, I targeted unused social styles with a regex for `.social-icon{`. One rule read:

```css
.cta .social-icon{color:var(--grey)}
```

Regex matched from `.social-icon{` rightward and deleted the declaration. Left `.cta` orphaned on its line. CSS ignores whitespace, so `.cta` glued itself to the next rule:

```css
.cta .mock{...}
```

`.mock` became a descendant selector matching nothing. Hero mockup lost `max-width`, negative margins, stacking context — full-bleed across the screen.

Valid CSS. Builds green, commits clean, zero warnings. Found it in visual regression, fixed by deleting the orphan, confirmed computed `max-width` back at 928px.

Migrated repo remotes from the retired pve01 bare repo to Forgejo on pve02 before pushing, so webhooks actually fired. Lesson filed: never regex-edit stylesheets. Orphaned preambles are valid syntax that silently unbinds everything below them.
