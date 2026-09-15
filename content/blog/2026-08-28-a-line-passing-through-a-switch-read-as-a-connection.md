---
title: "A Line Passing Through a Switch Read as a Connection"
date: 2026-08-28
category: Homelab
summary: "A storage move recovered the VM from a failing NAS pool. In the architecture diagram, one innocent line also made an isolated switch look directly connected."
---
My primary VM lived on the NAS pool. The pool started timing out reads and refusing to give back freed space. Moved the 150 GiB disk image to local NVMe on the hypervisor.

Transfer hit four zero-filled sectors at offsets 30360, 30361, 53642, 73119 MiB — 0.0026% of the image. Filesystem check: all four in unallocated blocks. Lucky. First NVMe boot mounted clean read-write, zero errors, every container came up. Dropped VM RAM 16 → 12 GB at the same time — without NAS buffering pressure the footprint didn't need it. Deleted the 150 GB source on the NAS afterward; appliance accounting never reclaimed the space. Which validated the whole move.

## The Diagram Lied

Redrew cluster docs — full LAN topology plus a cluster interconnect schematic (corosync rings, fencing, guest maps) from the hourly state queries. Review caught it: a dashed fallback path from one node ran vertically straight through the bounding box of an isolated secondary switch. Meant as logical routing to something downstream. Reads as a physical uplink to a switch with no cables in it.

Fixed three ways: rerouted the path around the switch perimeter, badged the switch "Isolated / No Direct Uplink" so proximity can't imply connectivity, restyled the whole theme to high-contrast slate for legibility.

## 584 Pages of Docs, Offline

Mirrored upstream technical docs into a local Markdown base — 584 pages, 6.8 MB: Concepts 187 files (50,093 lines), Tasks 213 (57,850), Reference 118, Tutorials 44, Setup 22. Five workers pulled from the published sitemap, chrome stripped, headings/code/tables/args verbatim.

Drew one scope line: per-object generated API pages (hundreds of repetitive entries) excluded, top-level index kept, rationale in provenance metadata. Mirror is a snapshot, not a tracking branch — a small query router maps CLI questions to local files so nothing needs the whole set in context.
