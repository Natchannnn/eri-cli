---
title: "Automated Patch Auditing with n8n and Deploying a Self-Hosted Forgejo Git Forge"
date: 2026-07-24
category: Homelab
summary: "Building an automated container and host update pipeline with n8n, debugging a silent bash parameter expansion defect in change evaluation, and deploying an LTS Forgejo git forge."
---
After completing a routine maintenance pass across thirty containers and host packages, I automated the evaluation of upstream updates. To replace manual changelog reviews, I configured an n8n pipeline to triage updates, debugged a silent parser defect in bash fallback parameter handling, and deployed a self-hosted Forgejo git forge configured with push mirrors to support existing edge deployment pipelines.

## Orchestrating patch reviews via n8n and changelog evaluation

The goal of the automation was to inspect pending apt packages and Docker container image digests daily, sorting each candidate into automatic application, postponement, or human review.

The automation runs through n8n on port 5678. To keep the orchestrator maintainable and testable outside the UI, logic is decoupled into shell scripts placed in `~/bin/`. An automated judge reviews upstream changelogs against explicit criteria: if an update involves a breaking major version bump or unverified dependency changes, the update is skipped and a detailed changelog summary is routed to a Discord notification channel for manual review.

Privileged execution is strictly scoped: the `sudoers` configuration enforces exact binary paths without wildcards to prevent option injection. During initial integration, an issue emerged where conditional branches downstream of Discord webhook notifications failed to execute. Because the Discord API returns an empty HTTP 204 body on successful webhook execution, downstream JSON parsers received null payloads, requiring explicit status-code branching rather than payload presence checks.

## Diagnosing a silent bash parameter expansion syntax error

During validation against eleven pending host packages, the evaluation engine successfully classified all updates as low-risk point releases. However, the execution pipeline consistently reported `skip`.

The discrepancy stemmed from a parameter expansion fallback in the orchestration script:

```bash
# Intended to supply an empty JSON object if JUDGE was empty:
PAYLOAD="${JUDGE:-{}}"
```

In bash, parameter expansion treats `{` as the default value string, appending the remaining `}` as a literal trailing character. Consequently, valid JSON output from the evaluator had a trailing closing brace appended (`{...}}`), causing `jq` deserialization to fail.

Because the pipeline caught the parsing failure and fell back to the safe default (`skip`), the workflow completed with zero exit errors and zero Discord alerts. The pipeline appeared operational while silently suppressing all legitimate patch applications. Replacing the syntax with an explicit null fallback and validating JSON object structure prior to branching resolved the evaluation logic:

```bash
PAYLOAD="${JUDGE:-null}"
if ! echo "$PAYLOAD" | jq -e 'type == "object"' >/dev/null 2>&1; then
  # Explicit error logging
fi
```

## Inventory audit and automated documentation generation

Running an inventory of the active homelab environment uncovered two inactive processes: an obsolete cron job attempting to bind a deprecated web root, and a legacy reverse proxy retaining ports 80 and 443 without routing active backend targets. Both were removed.

To prevent documentation from lagging behind container changes, I built an event-driven documentation updater. A host daemon monitors Docker engine events via the socket API (`docker events --filter 'event=create'`). When container creation events fire, the daemon waits sixty seconds to debounce batch deployments, sanitizes sensitive tokens and environment variables from `docker-compose.yml`, and generates updated stack reference documentation. The watcher automatically tracks both terminal `docker compose` invocations and Portainer stack deployments.

## Hardware diagnostics: Realtek USB Ethernet link failure

Troubleshooting a new handheld gaming console connected via a 2.5GbE USB-C adapter initially pointed toward management VLAN MAC filtering. However, network sweeps revealed that the device never generated link pulses or DHCP discovery broadcasts.

Physical layer inspection confirmed the port remained in a link-down state across autonegotiation, forced 2.5 Gbps, and forced 1.0 Gbps duplex modes. The interface failure was isolated to a missing Realtek driver on the console's clean OS image, preventing the physical controller from initializing. Additionally, a five-port gigabit switch previously disconnected from the port required resetting link negotiation overrides before re-establishing connectivity.

## Experimental document OCR pipeline validation

As a separate engineering experiment, I implemented a local document ingestion script designed to extract structured telemetry from photographed work orders. Using schema validation with defined type boundaries and confidence thresholds, the script extracted sixteen target fields across three sample formats without key-level errors, while correctly discarding noisy control images. Because production forms have not yet been standardized, the background daemon was stopped and archived with its systemd unit files preserved for future integration.

## Deploying Forgejo with GitHub push mirrors

To establish local version control for private infrastructure scripts and runsheets, I deployed Forgejo (the non-profit fork of Gitea). 

Key architectural requirements included preserving Vercel's automated deployment webhooks, which integrate natively with GitHub:
- **Topology**: Forgejo acts as the primary authoritative git host, while configuring automated push mirrors to private GitHub repositories ensures zero disruption to external build triggers.
- **SSH Connectivity**: The Forgejo container runs its SSH listener on port 2222. Initial push mirror syncs failed with HTTP 500 until the remote host keys were populated in `/etc/ssh/ssh_known_hosts`.
- **Backup Verification**: Scheduled daily dumps write compressed tarballs directly to the NAS NFS datastore. Initial backup verification confirmed a 433 MB archive creation and passing healthchecks.

Within two minutes of Forgejo's container startup, the automated documentation watcher detected the new stack and generated a verified service document on disk, confirming the event-driven documentation pipeline in production.
