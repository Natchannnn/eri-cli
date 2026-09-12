---
title: "Automating the Blog Publishing Pipeline and Cleaning Portfolio Placeholders"
date: 2026-06-09
category: Projects
summary: "Setting up GitHub Actions for automated manifest generation, purging early placeholder posts, and simplifying homepage project tiles."
---
Automating the blog publishing workflow transitioned the site from manual script execution to continuous deployment via GitHub Actions.

## Automating Manifest Generation

The initial workflow required running a local Node.js script to extract frontmatter and rebuild `posts.json` before committing changes. To streamline this, I established a GitHub Actions workflow (`.github/workflows/blog-publish.yml`). The job triggers on pushes containing `.md` files under `blog/posts/` on the main branch, executing `scripts/regenerate-manifest.js` to compile the manifest automatically.

Configuring the workflow surfaced two git permission and synchronization issues:
1. The personal access token (PAT) lacked the `workflow` permission scope required to commit within `.github/workflows/`, rejecting the initial push.
2. After updating credentials, the remote repository advanced because the GitHub Action immediately committed an updated `posts.json` on the first push. Resolving this required a local stash, rebase against remote main, and re-pushing cleanly.

## Purging Placeholder Articles

Three test markdown files from initial frontend prototyping were still present in `blog/posts/`, appearing in the archive index. These unreferenced placeholder files were removed from the repository, ensuring the public archive displayed only genuine operational journal entries.

## Portfolio Interface Refinement

The Portfolio Showcase on the homepage was audited for visual clarity and authentic utility. Three static, non-interactive tiles—Certifications, Experience, and Tech Stack—were removed because they functioned solely as decorative filler without linking to underlying projects or evidence.

The remaining active project categories (In Progress, Upcoming, Completed) were set permanently visible by default, eliminating an unnecessary toggling button. Additionally, the portfolio copy was refined to specify actual operational scope: designing and deploying managed network infrastructure for residential and commercial spaces up to 1,000m².

## Pending Verification

- Update DNS CNAME records to point `n5hq.me` to Vercel production hosting.
- Review access control rules for sensitive self-hosted endpoints.
