---
title: "GitHub Actions Committed Before I Could Push"
date: 2026-06-09
category: Projects
summary: "The first automated blog publish committed before my local push, so I had to fix the workflow race before cleaning up the site."
---
I got tired of running my Node script by hand every time I wanted to publish, so I wired up a GitHub Actions workflow (`.github/workflows/blog-publish.yml`). Push any `.md` under `blog/posts/` on main, it runs `scripts/regenerate-manifest.js` and rebuilds `posts.json` for me.

It bit me twice on day one.

First push got rejected. My PAT didn't have the `workflow` scope, so anything touching `.github/workflows/` just bounced. Fixed the token, pushed again — and then the remote had already moved, because the Action had committed a fresh `posts.json` the second my first push landed. Had to stash locally, rebase against main, push clean. Classic.

## Deleted the Test Posts

Three leftover markdown files from early frontend prototyping were still sitting in `blog/posts/` and showing up in the archive. Deleted them. The archive only shows real journal entries now.

## Cleaned Up the Homepage

My Portfolio Showcase had three dead tiles — Certifications, Experience, Tech Stack. They didn't link anywhere, just sat there looking decorative. Removed all three.

I also killed the toggle button for the project categories. In Progress, Upcoming, Completed are just always visible now. And I rewrote the copy to say what I actually do: designing and deploying managed network gear for homes and commercial spaces up to 1,000m².

DNS for `n5hq.me` to Vercel is still pending. Left it for tomorrow.
