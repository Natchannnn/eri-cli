---
title: "Hardening Command Execution and Resolving Deployment Pipeline Blocks"
date: 2026-08-09
category: Homelab
summary: "Closing remote code execution risks in n5-board, configuring host sandboxing, resolving GitHub push-mirror workflow scopes, and deploying hardware corrections."
---
Engineering work this morning spanned four related operational areas: closing a command injection risk in the board executor, configuring an unprivileged worker account with systemd socket isolation, fixing GitHub push-mirror authentication scopes, and clearing a blocked production deployment.

## Hardening evidence_cmd execution in n5-board

The primary task was resolving C1, an architectural security vulnerability in the board tool: backlog cards could specify an `evidence_cmd` executed to verify completion. If evaluated directly by a shell, this creates an arbitrary command execution primitive within the ledger. Closing this required strict input handling and verified provenance.

First, execution mechanics were constrained: commands are parsed strictly as argv lists without shell evaluation, resolving binaries via absolute paths against an explicit argument allowlist, enforced by a 120-second execution timeout and dedicated exit codes. Mutation testing caught an initial defect: toggling `shell=False` to `True` hung the test runner because stdin had not been redirected, leaving child processes waiting indefinitely on inherited terminal input. This was resolved by explicitly setting `stdin=DEVNULL`.

During testing, a background mutation job completed its cycle by restoring the executor script from a pre-test backup, inadvertently reverting the stdin patch. Because the job exited cleanly, the reversal was caught only by inspecting the final restoration logs. Stale backup files were purged and the fix reapplied.

Second, provenance was enforced: the `check` subcommand was restricted to reading `evidence_cmd` values exclusively from the committed backlog file, ignoring descriptions, comments, and labels. Adversarial testing verified that injecting hostile payloads into card metadata did not execute, as the tool read exclusively from the ledger. A structural regression test was added to enforce read-only semantics against the backlog file in code rather than documentation.

## Sandboxed worker identity and systemd socket isolation

Next, an unprivileged worker identity was configured on the primary host. The setup created a dedicated service account without membership in `sudo`, `docker`, `lxd`, or `adm`, set restrictive vault filesystem ACLs, marked the worker binary immutable, and established OAuth credentials.

Auditing `/etc/sudoers` clarified that the automation account held passwordless reboot privileges without a required TTY, correcting an inaccurate operational assumption that the account lacked sudo access entirely.

Configuring socket isolation required debugging `systemd` isolation semantics. An initial socket probe script failed to run because `DynamicUser=yes` implies `PrivateTmp=yes`, hiding temporary test probes from `/tmp`. Resolving this with a read-only bind revealed that attempting to restrict individual socket paths failed empirically: processes retained access through parent directories. The configuration was updated to deny access to the entire runtime directory rather than individual paths, and the systemd unit file was updated accordingly.

## Resolving GitHub push-mirror workflow scopes

Porting the C1 command-hardening fix to `plankamd` completed with 302 passing tests, a version bump, and release tagging.

Pushing to Forgejo succeeded, and Forgejo's web UI reported the GitHub push-mirror sync as successful, showing an updated `last_update` timestamp. However, executing `git ls-remote` against GitHub revealed an empty repository with zero branches or tags. Inspecting GitHub API error logs exposed the underlying failure: GitHub rejected push updates containing `.github/workflows/ci.yml` because the Personal Access Token lacked the `workflow` scope. Granting `workflow` permissions to the token resolved the block, allowing all three refs to synchronize cleanly on the subsequent attempt. The release was verified by installing the tag into a fresh environment directly from GitHub.

## Production deployment visibility workarounds

The final task addressed hardware specification corrections on the public website, updating memory figures and host model names across four pages and retiring references to decommissioned DNS filtering infrastructure.

While git pushes succeeded across all remotes without errors, production builds remained halted in a `BLOCKED` state. Inspecting hosting metadata revealed the repository had been switched to private, triggering an automated build block (`githubRepoVisibility: "private"`). To restore service without publishing uncommitted workspace state, the target commit was exported into an isolated clean directory and deployed via an explicit project link. Verification was conducted by curling the production HTML directly on both live domains. The repository was restored to public visibility at 07:56.

Across each track—executor test restoration, git mirror synchronization, and static hosting builds—status indicators frequently reported completion while the target artifacts were unchanged. Verifying output state directly on GitHub, in the deployment environment, and across file hashes prevented silent rollbacks.

Finally, reconciling transcript logs highlighted the eight-hour difference between UTC server timestamps and local time, ensuring maintenance log timestamps were accurately recorded across subsequent entries.
