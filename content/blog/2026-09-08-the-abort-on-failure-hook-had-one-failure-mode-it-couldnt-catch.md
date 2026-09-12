---
title: "Version-Controlling Pre-Commit Hooks, Design Source Submodules, and Preview Generation"
date: 2026-09-08
category: Web
summary: "Placing local pre-commit hooks into tracked repository source, establishing an isolated design repo, extracting inlined web assets, and deploying an automated /dev/v3 preview."
---
The pre-commit hook that rewrites the site's hero stat tiles from live container counts is now tracked source instead of a file that only ever existed on one machine. It lives at scripts/hooks/pre-commit (123 lines) with a README next to it, and .git/hooks/pre-commit is now a symlink into that tracked file rather than a separate copy, so there is one file to edit and diff instead of two that can drift apart. The hook still aborts the commit loudly if it can't reach the host or gets back a non-numeric or zero count, a behavior added earlier this year to replace an older version that failed silently. Putting the hook under version control closes the gap that fix left open: an abort-on-failure hook that exists nowhere but one machine's .git/hooks/ can vanish without a trace, and a missing hook aborts nothing.

The redesign's entire design source, 77 files of logo iterations and stylesheet revisions, got its own nested private git repository, scoped to just that one folder so the public site history stays untouched. It's the first time any of that work has had commit history, and the first push was confirmed by checking the ref on the server rather than trusting a clean exit code.

The redesign itself shipped as a preview at /dev/v3 on the lab host: a routing rewrite from the portfolio host, noindex on every page, and a robots.txt disallow on /dev/ so it stays out of search results while it's still changing daily. A 379-line Python generator builds the preview tree from the design source rather than a hand copy, and it checks its own output before calling a build good: every internal link gets rewritten for the /dev/v3 base path, the generator regex-scans the result for anything that wasn't, and the build fails on an unprefixed link. It also diffs two consecutive runs against each other rather than assuming the generator is idempotent by design.

## Also today

The same pass pulled the wordmark and a display font out of the markup, where both had been base64-inlined into all six preview pages, about 93 KB repeated per page because inlining doesn't cache. Extracted to real files and cached once instead of shipped six times, the six pages' combined HTML dropped from 916 KB to 127 KB.

Preview status: the preview lists all 34 blog posts, but only one has real body content. The rest render from metadata only until the blog generator learns the new template. Nine navigation tests passed against the deployed preview in a real browser, which covers the chrome, not the posts that aren't there yet.
