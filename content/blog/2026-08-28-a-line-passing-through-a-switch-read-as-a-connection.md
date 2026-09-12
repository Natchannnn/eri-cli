---
title: "Local Storage Migration, Network Topology Corrections, and Documentation Mirroring"
date: 2026-08-28
category: Homelab
summary: "Migrating VM storage off failing NAS disks to local NVMe, clarifying isolated switch topology in architecture diagrams, and building a 584-page offline documentation mirror."
---
Infrastructure work on August 28 covered three distinct operational tasks: migrating the primary VM's virtual disk from an unstable NAS pool to local NVMe storage, correcting topological ambiguities in cluster architecture diagrams, and mirroring upstream technical documentation into a local knowledge base.

## Migrating VM virtual disks off degraded NAS storage

The primary VM disk image previously resided on an external NAS volume that was exhibiting intermittent read timeouts and failing to reclaim freed disk space.

To eliminate storage volatility, the 150 GiB virtual disk image was cloned to local NVMe storage on the hypervisor node. During the transfer, four sectors returned zero-filled read errors at offsets 30360, 30361, 53642, and 73119 MiB (a 0.0026% defect rate). Verifying the filesystem showed that all corrupted sectors fell into unallocated blocks. Upon initial boot from NVMe, the root filesystem mounted clean read-write with zero errors, and all containerized workloads initialized normally.

VM memory allocation was concurrently resized from 16 GB to 12 GB, reflecting actual memory footprint requirements once disk buffering pressure was removed. Deleting the source 150 GB image on the NAS confirmed that appliance space accounting remained un-reclaimed, validating the decision to relocate workloads to local physical disks.

## Clarifying un-uplinked switches in network topology diagrams

Cluster documentation was updated with two architectural diagrams: an overall LAN topology (firewall gateway, core switch, hypervisor nodes, storage units, and overlay mesh) and a detailed cluster interconnect schematic (corosync rings, fencing mechanisms, and guest mappings) derived from automated hourly state queries.

During review of the cluster diagram, a routing ambiguity was identified: a dashed fallback path from one hypervisor node was drawn vertically, passing directly through the bounding box of an isolated secondary switch. Although the line was intended to represent logical routing to a downstream target, visual overlap created the false appearance of an active physical uplink to a switch that had no physical network connection.

The schematic was corrected:
1. The fallback path was routed around the switch perimeter to eliminate visual intersection.
2. The isolated switch was explicitly annotated with an "Isolated / No Direct Uplink" badge, preventing readers from inferring connectivity from visual proximity.
3. The visual theme was adjusted to a high-contrast slate palette to improve hierarchy and icon legibility.

## Offline documentation mirroring and knowledge routing

The final track involved archiving upstream technical documentation into an offline Markdown knowledge base, capturing 584 pages across 6.8 MB:
- **Concepts**: 187 files (50,093 lines)
- **Tasks**: 213 files (57,850 lines)
- **Reference**: 118 files
- **Tutorials**: 44 files
- **Setup**: 22 files

Five parallel workers retrieved pages directly from the published sitemap, stripping navigation chrome while preserving headings, code syntax, tables, and command arguments verbatim.

A deliberate scope boundary was applied within the reference section: generated per-object API specification pages (spanning hundreds of repetitive entries) were excluded in favor of top-level indexing, with the rationale documented in provenance metadata. Because the mirror reflects a snapshot in time rather than an active upstream tracking branch, a lightweight query router was deployed to map CLI queries to relevant local files without requiring entire documentation sets to fit into active context windows.
