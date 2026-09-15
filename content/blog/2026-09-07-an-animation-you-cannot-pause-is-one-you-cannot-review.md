---
title: "An Animation You Cannot Pause Is One You Cannot Review"
date: 2026-09-07
category: Web
summary: "Implementing deterministic animation frame control via renderAt(ms) and relative clocks, and running multi-critic review cycles on homepage WebGL components."
---
Three homepage pieces, three critics each, plus the determinism work to make the verdicts mean anything.

Each round: build once, render once, hand to three critics with fresh context. Brief checks it does what's asked, System checks the written spec, Craft blind-compares against the reference. Brief + System is the floor. Craft is what ships. Every piece got a round ceiling up front — non-converging work gets banked, not fed the rest of the day.

Corner instruments piece — wordmark, telemetry cluster, clock digits rolling up from zero, viewport readout — passed all three at round 4. Only ship-quality piece today.

Making it reviewable took four stacked fixes. `renderAt(ms)` pauses the live loop and renders one frame synchronously, with an explicit paused flag so the loop can't advance between render and screenshot. Capture schedule moved off `Date.now()` onto an animation-relative clock — wall-clock made every "deterministic" frame show assembly complete at t=0. Captures got a dynamic sleep landing within ~100ms of target, after a fixed delay let one rest frame land 3.5s late inside a transition.

## What didn't clear

Hero object hit its ceiling at round 10 — still failing System on a column gap, Craft on reading static instead of alive. Integration (hero + instruments + nav, timed corner reveal) was three rounds deep at end of day.

Two render bugs on the way. Migrating blades ghosted translucent where they crossed seated ones — coincident geometry z-fighting in the depth buffer, fixed with a small deterministic forward nudge. Blades also shared a material array with their host column, so dimming a column dimmed its migrant blades — split blades to their own always-lit array. A "columns are touching" critique traced to a real gap that disappears in silhouette at that camera angle — fixed the projection, not the geometry.

Critics kept suggesting the reference's own geometry would score higher on Craft. Spec forbids it. Took the Craft loss rather than converge on the one thing the piece exists to teach.

Seventeen build-and-judge rounds, three pieces, 206+ messages. One piece passed everything. Committed nothing — nothing else cleared the bar.
