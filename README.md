# eri-cli

Static portfolio site for Eric Li (systems engineering, homelab infrastructure, and network operations).

## Overview

- **Stack**: Semantic HTML5, CSS, Vanilla JavaScript. No framework dependencies.
- **Visuals**: Procedural Three.js WebGL terrain with a 2D canvas fallback and SVG poster for mobile viewports.
- **Blog Engine**: Node.js static compiler (`scripts/build-blog.js`) converting Markdown sources to static HTML routes.

## Directory Layout

```
.
├── index.html              # Homepage (Three.js terrain, proof metrics, featured projects)
├── projects.html           # Project catalog and technical stack details
├── about.html              # Background, homelab history, and roadmap
├── assets/
│   ├── css/style.css       # Unified design system and responsive grid
│   ├── fonts/              # Self-hosted webfonts (PP Kyoto, Authentic Sans, Pitch Sans)
│   ├── img/                # Favicon and static assets
│   └── js/
│       ├── home.js         # Homepage state, project tabs, scroll handler, script loader
│       ├── terrain.js      # Three.js procedural landscape engine and curtain shader
│       ├── pages.js        # Subpage full-slide snapping and keyboard navigation
│       └── three.min.js    # Three.js library (r128)
├── blog/                   # Compiled static blog reader pages
├── content/
│   ├── blog/               # Markdown source files for blog posts
│   └── articles.json       # Metadata registry of all articles
├── scripts/
│   └── build-blog.js       # Zero-dependency static site generator
└── templates/
    └── blog-post.html      # Shell template for compiled blog posts
```

## Local Preview

Serve the root directory with any local HTTP server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .
```

Open `http://localhost:8000`.

## Site Maintenance

### Projects

1. **Full list (`projects.html`)**: Project entries live in `<ol class="project-ledger">`. To add an entry, append an `<li class="project-entry">` containing the title, description, and facts.
2. **Homepage highlights (`index.html`)**: The top 3 projects are defined in the `#projects` section and configured in `assets/js/home.js` (`projectData` array).

### Blog Posts

Source articles are stored in `content/blog/` as Markdown files named `YYYY-MM-DD-slug.md`.

Each post requires YAML frontmatter:

```markdown
---
title: "Setting Up Proxmox VE Clustering"
date: 2026-10-15
category: Homelab
summary: "Corosync quorum configuration, shared ZFS storage, and migration testing."
---

Article body in standard Markdown.
```

To compile posts and update `blog/index.html`:

```bash
node scripts/build-blog.js
```

The script parses Markdown, calculates reading time, wires previous/next post links, and regenerates static HTML routes into `blog/<slug>/index.html`.

### Contact Details

Contact links and email (`helloworld@n5hq.me`) are defined in the footers of `index.html`, `about.html`, `projects.html`, and `templates/blog-post.html`.
