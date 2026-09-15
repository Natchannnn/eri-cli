---
title: "My About Page Said Full-Stack Developer and Meant Nothing"
date: 2026-06-13
category: Projects
summary: "My About page sounded like a job-description generator. I replaced the claims with things I could prove and rebuilt the project cards around native HTML."
---
Was working on staging (port 3002) today, just reading my own portfolio copy. My About said "passionate full-stack developer with deep expertise in building scalable solutions."

I deleted it. It says nothing.

Rewrote it around stuff I can actually prove: my homelab — five isolated VLANs, twenty-odd containers, dashboards that run all day. Said outright I'm heading toward networking and infrastructure engineering. Changed the hero title to "Full-Stack & Infrastructure" and swapped the marketing headers for plain ones. "Work that ships and runs" beats whatever I had before.

## The Pills That Weren't Buttons

Under Portfolio I had three pills — Completed, In Progress, Upcoming. They looked like buttons. They did nothing.

Made them real anchor links to the project groups. Had to fiddle with offset margins so the fixed nav doesn't cover the headings when you jump. Small thing, bugged me for weeks.

## Cards Were Too Tall

Every project card showed everything at once — full specs, paragraphs, tags. Endless scroll.

Rebuilt them on native `<details>` / `<summary>`. Collapsed you get title, one line, a Details trigger. Click, you get architecture, metrics, tags. No JS needed.

Hid the default browser triangles with `summary::-webkit-details-marker { display: none; }` and `summary { list-style: none; }`, rolled my own little indicators that rotate on toggle.

Still on staging only. Want to check keyboard access and mobile taps across Chromium, WebKit, Gecko before I push to Vercel.
