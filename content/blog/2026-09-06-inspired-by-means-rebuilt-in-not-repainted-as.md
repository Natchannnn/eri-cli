---
title: "Site Redesign on LaunchDarkly Page Architecture and Component Vocabulary"
date: 2026-09-06
category: Web
summary: "Rebuilding site layouts and tokens referencing LaunchDarkly's banded section architecture, resolving nested anchor bugs, and updating generator templates."
---
Shipped a full redesign today, rebuilt from LaunchDarkly's page architecture rather than its colours: banded sections, a persistent rail, one fixed section order, and a small vocabulary of components reused everywhere. The home page, the lab page, the blog index, all 34 post pages, five portfolio pages and the 404 now share that vocabulary, with no new class names invented past the first two pages.

Section order (About, Portfolio, Blog, Lab, Contact) is locked across three surfaces that have to agree: the nav links, the page flow, and the footer's section column. The lab page picked up the same top bar and components, with its terminal panel now showing real cluster and container status instead of placeholder text.

Colour moved to a single accent system: a blue for fills, a violet for paint, three neutrals, near-black panels and canvas. Type dropped to a text face plus a mono, replacing the old single variable family. Contrast got measured, not eyeballed: the muted label colour was 58% lightness against the near-black panel, which works out to 3.82:1 and fails AA for small text. Raised to 60.5%, for a 5.1:1 minimum with margin. The accent violet needed a second token, --violet-txt, for small text specifically, since the value that worked at large sizes failed at small ones.

Two bugs turned up in the card markup: cards were anchors with tag-pill anchors nested inside them, which browsers silently un-nest by closing the outer tag early. Hit on the resource cards, then again on the post cards before the pattern was recognized. Both were fixed by moving the click target to the card's container and making the card itself a plain article.

build_blog.py, the script that generates each new post's HTML, keeps its own copy of the page chrome independent of the real templates, and had to be rewritten by hand to match. Skipping that step would have shipped the next generated post with the old header and footer sitting inside the new stylesheet.

One page sits behind an access gate and links the shared stylesheet directly. It was frozen to its own copy and repointed before the public redesign went out, so it kept rendering correctly through the change and is now deliberately separate from the new system rather than accidentally behind. After all 34 posts were re-templated, their prose content was checked byte-identical against the previous version, confirming the re-template changed only the frame and not the words.

The day started with a different approach: keep the existing markup and swap in the reference's palette and fonts, verified across 45 files and 49 replaced colour values. Review rejected it outright, since the point of the reference was its structure, not its hex codes, so that version was scrapped and the shipped one was built from an empty stylesheet instead.
