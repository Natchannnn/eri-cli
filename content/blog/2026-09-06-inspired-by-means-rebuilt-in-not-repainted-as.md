---
title: "Inspired-By Means Rebuilt-In, Not Repainted-As"
date: 2026-09-06
category: Web
summary: "Rebuilding site layouts and tokens referencing LaunchDarkly's banded section architecture, resolving nested anchor bugs, and updating generator templates."
---
Shipped a full redesign today. Rebuilt from LaunchDarkly's page architecture, not its colors: banded sections, a persistent rail, one fixed section order, a small component vocabulary reused everywhere. Home, lab, blog index, all 34 post pages, five portfolio pages, 404 — same vocabulary, zero new class names past the first two pages.

Section order (About, Portfolio, Blog, Lab, Contact) is locked in three places that have to agree: nav links, page flow, footer section column. Lab page got the same top bar + components, terminal panel now showing real cluster and container status instead of placeholder text.

One accent system: blue for fills, violet for paint, three neutrals, near-black panels and canvas. Type down to a text face + a mono — old single variable family is gone. Contrast measured, not eyeballed: muted labels at 58% lightness on near-black = 3.82:1, fails AA small text. Raised to 60.5% → 5.1:1 with margin. Accent violet needed a second token (`--violet-txt`) just for small text — the large-size value failed small.

Two card bugs, same shape: cards were anchors with tag-pill anchors nested inside. Browsers silently un-nest those by closing the outer tag early. Hit resource cards first, then post cards before I recognized the pattern. Fix both times: click target moves to the container, card becomes a plain article.

`build_blog.py` keeps its own copy of page chrome apart from the real templates — rewrote it by hand to match. Skip that and the next generated post ships old header/footer inside the new stylesheet.

One gated page links the shared stylesheet directly. Froze it to its own copy and repointed before the public rollout, so it rendered straight through the change — deliberately separate now, not accidentally behind. All 34 posts re-templated, prose verified byte-identical after: frame changed, words untouched.

Honest footnote: day started as a repaint — same markup, swapped palette + fonts, 45 files, 49 color values. Review killed it outright. The reference was structure, not hex codes. Scrapped it, rebuilt from an empty stylesheet.
