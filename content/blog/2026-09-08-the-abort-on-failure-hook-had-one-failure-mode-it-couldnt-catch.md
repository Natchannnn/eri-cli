---
title: "The Abort-on-Failure Hook Had One Failure Mode It Couldn't Catch"
date: 2026-09-08
category: Web
summary: "The pre-commit guard lived only in one machine's untracked hooks directory. I moved it into the repository before building the isolated v3 preview."
---
My hero-stat pre-commit hook — rewrites site tiles from live container counts — existed on exactly one machine, untracked, in `.git/hooks/`. An abort-on-failure hook that vanishes with a disk wipe aborts nothing. It's tracked source now: `scripts/hooks/pre-commit` (123 lines) + README, `.git/hooks/pre-commit` symlinked to it. One file to edit and diff, not two drifting copies. The abort-loud behavior (no host reach / non-numeric / zero count) stays — added earlier this year to replace the version that failed silently. This closes the remaining hole: the guard itself is now versioned.

Design source — 77 files of logo iterations + stylesheet revisions — got its own nested private repo scoped to that folder, public site history untouched. First time that work has commit history. Verified the first push against the server ref, not the exit code. Old habits.

Redesign ships as a preview at `/dev/v3` on the lab host: routing rewrite off the portfolio host, noindex everywhere, `robots.txt` disallowing `/dev/` until it's stable. A 379-line Python generator builds the preview tree from design source — no hand copies — and validates itself: every internal link rewritten for the `/dev/v3` base, regex scan for stragglers, build fails on any unprefixed link. It diffs two consecutive runs against each other instead of assuming idempotence.

## Also today

Wordmark + display font were base64-inlined into all six preview pages — ~93 KB repeated per page, and inlined bytes don't cache. Extracted to real files, served once: six pages combined 916 KB → 127 KB.

Preview lists all 34 posts, but exactly one has body content. Rest render metadata-only until the blog generator learns the new template. Nine nav tests green in a real browser — covering chrome, not the posts that aren't there yet.
