---
title: "Configuring Model Proxy Spend Caps, Documentation Tiering, and Availability Trade-offs"
date: 2026-08-27
category: Homelab
summary: "Resolving YAML indentation in model proxy spend caps, restructuring root instructions into tiered documentation, and evaluating secret store availability."
---
Engineering work on August 27 encompassed three distinct operational areas: correcting model proxy budget cap configurations, restructuring system instructions into tiered documentation, and evaluating availability dependencies during external secret store outages.

## Model proxy spend cap indentation and validator alignment

While inspecting model gateway configurations, an indentation error was identified in the spend control block. In YAML configuration, `max_budget` was positioned as a sibling of the `parameters` block rather than nested under it. Because the parser expected `parameters.max_budget`, the proxy found no budget cap defined and initialized with unconstrained spend limits, generating no syntax errors or startup warnings.

A custom configuration validation script failed to flag the omission because it checked for the existence of `max_budget` at the incorrect sibling path, mirroring the defect in the configuration file itself.

Both the configuration and the validator were updated:
- `max_budget` was nested under `parameters`.
- The validator script was updated to assert the enforced schema path.
- Querying the running proxy API confirmed the spend limits ($20 and $10) appeared in the runtime configuration for both budget tiers.

While configuration ingestion was confirmed via API telemetry, active request rejection at the spending boundary remains untested in this window.

## Endpoint hardening and admin interface reachability

To reduce attack surface, public documentation endpoints (`/docs` and `/schema`) were restricted. An initial attempt applied a broad API-disabling flag that inadvertently blocked the management interface used to monitor active keys, spend metrics, and cache hit rates.

The configuration was refined using granular flags: documentation and schema endpoints return HTTP 404, while the administrative management interface remains accessible with HTTP 200 responses.

## External secret store availability dependencies

During startup testing, the external secret management service experienced a two-hour outage. Because the model proxy startup automation fetched upstream provider API keys directly from the vault on boot, the container could not start while the external vault API was unreachable.

This highlighted an operational availability dependency: migrating secrets out of static host files into centralized vaults reduces exposure risks while introducing runtime availability coupling to external networks. To mitigate boot dependency risks during network disruptions, an encrypted local secret store was configured as an offline fallback mechanism.

## Restructuring system instructions into tiered documentation

Work proceeded on optimizing the repository root instruction file (`CLAUDE.md`), which had expanded to approximately 11,000 words. The objective was splitting the monolithic file into a fast-loading hot tier for routine sessions and a detailed cold tier for reference.

During condensing passes, paraphrasing status lines risked semantic drift: summarizing operational notes inadvertently introduced conflicting statuses (such as labeling active production services as untested). The review process established a strict rule: operational status markers and project states must be migrated verbatim rather than paraphrased.

## Hypervisor reboot and filesystem write integrity

During container reconfiguration on the proxy virtual machine, executing an ungraceful reboot via `qm reboot` while Docker was actively committing container layer writes corrupted a local container image, requiring a clean rebuild. This reinforced operational procedures: VM reboot commands should be preceded by graceful service stops (`docker compose down`) to ensure container filesystems unmount cleanly.
