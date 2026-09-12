---
title: "Shell Parameter Expansion Traps in Credential Migration and Log Timezone Correlation"
date: 2026-08-25
category: Homelab
summary: "Eliminating plaintext credential fallbacks, isolating shell parameter expansion leaks during interactive debugging, and aligning UTC-local log timelines during appliance reboots."
---
Engineering work on August 25 focused on completing a phased credential migration into secure vault storage, remediating an interactive shell variable expansion leak, and correlating asynchronous system logs.

## Shell parameter expansion traps during credential testing

While verifying environment variables during an interactive debugging pass, a shell syntax trap exposed token material into session transcript logs.

Testing variable presence was attempted using standard shell substitution idioms:
```bash
echo "${TOKEN:-UNSET}"
```
While intended to display a fallback placeholder when unassigned, this parameter expansion evaluates and outputs the active value whenever the variable is defined. Consequently, attempting to confirm token existence inadvertently printed the live credential to standard output.

Remediation was executed immediately:
1. The exposed token was revoked at the authentication provider, with revocation confirmed via HTTP 401 responses.
2. Replacement credentials were provisioned and validated out-of-band.
3. A subsequent occurrence exposed secondary service identifiers under the same shell pattern. Those tokens were similarly invalidated, rotated, and verified.

To prevent recurrence, expansion-based presence testing was formally deprecated across all operational runbooks and scripts in favor of non-expanding variable inspection:
```bash
if [ -n "${TOKEN+x}" ]; then echo "Set"; else echo "Unset"; fi
```
This syntax asserts variable definition without evaluating or printing underlying string contents.

## Plaintext credential decommissioning across hosts

Decommissioning legacy plaintext credential files progressed across three cluster hosts:
- Host 1: Reduced from 17 orphaned credential files to 2.
- Host 2: Reduced from 19 files to 1.
- Host 3: Reduced from 3 files to 0.

Each deletion was preceded by system-wide grep queries to confirm no active services, timers, or scripts retained file path references.

Two persistent files were uncovered through global filesystem sweeps:
1. An environment file sourced inside a shell profile prior to non-interactive environment guards, quietly exposing variables to batch tasks.
2. A configuration file preserved during an uncataloged directory relocation outside standard search roots.

Both artifacts were sanitized and migrated to the centralized vault.

## Correlating multi-system logs across UTC and local time

Correlating intermittent backup storage errors with appliance instability initially stalled due to timestamp formatting differences. The primary backup host logged events in UTC, whereas the storage appliance logged timestamps in local time (UTC+8).

Normalizing the eight-hour offset established an exact temporal match: every logged backup storage timeout corresponded directly to an ungraceful appliance reboot. Evaluating power monitoring across adjacent cluster hardware confirmed neighboring nodes experienced zero power interruptions, isolating the instability to appliance-specific events rather than facility-wide outages.

## Webhook rotation and monitoring state preservation

A webhook credential embedded in legacy configuration archives was rotated in place. Updating the existing token reference preserved 19 active service bindings, avoiding recreation routines that would have invalidated attached notification targets. Secret updates were passed via standard input pipelines rather than CLI invocation arguments, preventing credentials from appearing in host process tables (`ps aux`).

Additionally, ahead of scheduled container maintenance, active monitoring probes were suspended using explicit API pause endpoints rather than configuration update mutations. This mitigated an Uptime Kuma defect where interrupted edit operations execute an un-transacted deletion that clears attached notification channels. Probes were inspected post-maintenance, verifying notification bindings remained intact.
