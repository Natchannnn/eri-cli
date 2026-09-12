---
title: "SSH Command Dispatch Hardening, Context Recovery, and Infrastructure Backlogs"
date: 2026-07-30
category: Homelab
summary: "Mitigating subshell injection vulnerabilities in automated SSH workflows with forced-command dispatchers, recovering rules from memory buffers, and structuring infrastructure backlogs."
---
A comprehensive infrastructure pass resolved an input-sanitization flaw in automated SSH workflows, restructured operational documentation across thirty runsheets, and established hardened execution boundaries for a planned automated task tracking service.

## Context recovery during tooling reinstallation

A maintenance pass to update development skills and configuration rules on the primary workstation exposed a gap in backup coverage. The local skill directory had lagged behind upstream revisions, preventing user-level extensions from loading.

Executing an uninstaller purged local directory state under `~/.claude/`. However, four custom condensed rule files were deleted in the process. Inspecting the 03:02 automated host backup archive revealed that `~/.claude/rules` had historically been excluded from backup inclusion lists.

Fortunately, because the active terminal session had loaded all four rule files into its memory context at initialization, the exact configurations remained present in the active session buffer. The files were restaged directly from memory buffers and archived to an external repository. To prevent future data loss, user configuration directories were explicitly added to the nightly backup manifest, while avoiding divergent local rule customizations in favor of standard upstream packages.

## Mitigating subshell injection in automated SSH execution

While auditing the parameter formatting of automated n8n workflows that invoke remote management scripts, I identified a command injection vulnerability.

The workflow constructed remote execution strings using JSON stringification:

```text
n5-doc-stack.sh {{ JSON.stringify($json.body?.project ?? '') }}
```

While `JSON.stringify` escapes string boundary quotes, it does not prevent bash subshell interpolation (`$(...)`). Executing a test payload with `$(id -un)` caused the remote server to evaluate the subshell and return the host's administrative username. Because the initiating webhook listener was accessible across the local network without authentication, the injection vector presented a critical privilege escalation risk.

Rather than attempting to construct sanitization filters within the workflow engine, I enforced security at the SSH transport layer on the target server. In `/root/.ssh/authorized_keys`, the automation's public key was bound to a restricted forced command:

```text
command="/usr/local/bin/ssh-dispatch.sh",no-port-forwarding,no-X11-forwarding,no-pty ssh-ed25519 ...
```

The `ssh-dispatch.sh` handler intercepts `$SSH_ORIGINAL_COMMAND` as unparsed text, matches it against a strict whitelist of twelve predetermined commands, and executes corresponding static binaries. 

During validation, live invocations initially failed because the n8n SSH client prepends `cd / ; ` to all remote command strings by default. Once the dispatcher script was updated to strip and normalize leading shell prefixes, all twenty-four invocation variants (both bare and prefixed) passed verification. Unmatched command attempts trigger rate-limited alerts to a dedicated security monitoring channel.

## Automated infrastructure audit and runsheet maintenance

To consolidate technical debt across the homelab, automated agents conducted a read-only audit across all system documentation, operational runsheets, and configuration files, generating `BACKLOG.md` (761 lines, 124 distinct actionable items). All supporting raw findings (403 cited references across 16 files, totaling 864 KB) were preserved and verified with cryptographic hashes.

A review of thirty operational runsheets evaluated proposals to condense historical incident logs:
- **Preserving Negative Evidence**: An initial proposal to purge diagnostic dead-ends was rejected. Documented ruled-out hypotheses—such as records confirming stable 53.4V PoE delivery during hardware restarts—serve as critical negative evidence that prevents engineers from repeating refuted investigations.
- **Pruning Stale Material**: A targeted review safely removed 57 lines of obsolete command syntax while establishing static cross-links between runsheets and the central backlog.
- **Reconciling Documentation Timestamps**: An apparent conflict between two network audit reports listing different VLAN IDs was resolved by examining commit metadata. The reports had been generated 42 minutes apart, accurately capturing state before and after a planned network renumbering pass.

## Repository mirroring and rsync delta performance

To provide offline access to critical upstream dependencies, I configured Forgejo to maintain private mirrors of thirty-eight starred GitHub repositories:

- **Mirror Recovery Verification**: Testing bare repository restoration revealed that invoking `git remote update` against an uninitialized repository directory fails with `no such file or directory`. Validated recovery procedures require executing a clean `git clone --mirror` into the target directory before database re-attachment.
- **Incremental Rsync Backups**: Backing up mirror data to the NAS via `rsync` encountered issues with permission bits and modification timestamps on the remote CIFS/NFS share. Configuring `rsync` to compare file size (`--size-only`) resolved synchronization stalls, reducing subsequent backup passes for 3.9 GB of repositories from 32 seconds to a 1.77-second incremental scan.
- **SMB Error 1219**: Windows workstation disconnects were traced to orphaned guest IPC$ sessions created during File Explorer browsing, resolved by terminating existing sessions before re-authenticating mapped drives.

## Task execution architecture for Planka

I initiated architectural planning for an automated task tracking board using Planka to manage infrastructure workflows.

A security review of early designs established strict execution boundaries:
- **Decoupling Authority from Cards**: Rather than embedding execution privileges or script parameters within task card metadata (which risks privilege escalation if unauthorized sessions alter card text), permissions are enforced via immutable, root-owned host configuration files.
- **Filesystem Isolation**: Workflows execute within ephemeral containers utilizing read-only volume mounts and drop all supplementary Linux capabilities (`NoNewPrivileges=true`), ensuring that automated tasks cannot alter underlying host configuration files or hypervisor state.
