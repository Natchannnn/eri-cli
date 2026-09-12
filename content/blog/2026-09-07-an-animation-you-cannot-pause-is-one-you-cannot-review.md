---
title: "Animation Review Controls, Deterministic Frame Capture, and Multi-Critic Evaluation"
date: 2026-09-07
category: Web
summary: "Implementing deterministic animation frame control via renderAt(ms) and relative clocks, and running multi-critic review cycles on homepage WebGL components."
---
Today's work was a three-critic review loop run against three homepage pieces, plus the determinism work needed to make an animated piece reviewable at all.

Each round builds the piece once, renders it once, and hands it to three critics with fresh context: Brief checks it does what was asked, System checks it against the written spec, Craft is a blind comparison against the reference. Brief and System passing is the floor; Craft passing is what ships. Each piece also got a round ceiling set in advance, so a piece that wasn't converging got banked instead of eating the rest of the day.

The corner instruments, a wordmark, a telemetry cluster, a clock whose digits roll up from zero, a viewport readout, passed all three critics at round 4. That is the one piece that shipped-quality today.

Getting an animated piece into a state where a critic's verdict meant anything took four stacked fixes. A renderAt(ms) call pauses the live loop and renders exactly one frame synchronously, with an explicit paused flag so the loop cannot keep advancing between the render call and the screenshot. The capture schedule moved from wall-clock timing to an animation-relative clock, after Date.now() timing made every "deterministic" frame show the assembly already complete at t=0. Captures also picked up a dynamic sleep tuned to land within about 100 milliseconds of target, after a fixed delay let one rest frame land 3.5 seconds late and catch a transition instead of a rest state.

## What didn't clear the bar

The hero object hit its round ceiling at round 10, still failing System on a column gap and Craft on reading as static rather than alive. Integration, hero plus instruments plus nav with a timed corner reveal, was three rounds in when the day ended.

Two rendering bugs turned up along the way. Migrating blades briefly rendered as translucent ghosts where they crossed seated ones, two pieces of coincident geometry fighting in the depth buffer, fixed with a small deterministic forward nudge. Blades also shared a material array with their host column, so darkening a column darkened blades that had migrated onto it too, fixed by splitting blades into their own always-lit array. A separate "the columns are touching" critique traced to a real geometry gap that vanished in the projected silhouette at that camera angle, so the fix changed the projection, not the geometry.

More than once a critic suggested that adopting the reference's own geometry would score better on Craft. The spec forbids it, so we took the Craft loss rather than converge on the one thing this piece exists to teach.

Seventeen build-and-judge rounds across three pieces, over 206 messages. One piece passed all three critics. Nothing was committed, because nothing else cleared the bar.
