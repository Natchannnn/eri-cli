---
title: "The Only Backup Was Still Open in the Chat Window"
date: 2026-07-30
category: Homelab
summary: "Mitigating subshell injection vulnerabilities in automated SSH workflows with forced-command dispatchers, recovering rules from memory buffers, and structuring infrastructure backlogs."
---
Updated my workstation skills/packages today and the uninstaller wiped `~/.claude/` — including four custom condensed rule files I'd written. Checked the 03:02 host backup: `~/.claude/rules` was on the exclusion list. Never backed up. Not once.

Only copy left was in my terminal's memory — the session had loaded all four at init. Restaged them straight out of the context buffer, archived to an external repo. User config dirs are in the nightly manifest now. And I'm done maintaining divergent local rule forks; upstream packages from here.

## The SSH One-Liner That Ran Somebody Else's Subshell

Auditing n8n → remote script calls, found this construction:

```text
n5-doc-stack.sh {{ JSON.stringify($json.body?.project ?? '') }}
```

`JSON.stringify` quotes the string. It does nothing about `$(...)`. Sent a test payload with `$(id -un)` — remote host evaluated it and handed back its admin username. The webhook listener was LAN-reachable with no auth. That's RCE with extra steps.

Didn't try to sanitize inside the workflow engine. Pinned it at the transport layer instead — forced command on the automation key in `/root/.ssh/authorized_keys`:

```text
command="/usr/local/bin/ssh-dispatch.sh",no-port-forwarding,no-X11-forwarding,no-pty ssh-ed25519 ...
```

`ssh-dispatch.sh` takes `$SSH_ORIGINAL_COMMAND` as raw text, matches against twelve whitelisted commands, runs static binaries. Anything else gets rate-limited alerts to the security channel.

Validation failed at first — all live calls bouncing. n8n's SSH client prepends `cd / ; ` to every remote string. Taught the dispatcher to strip and normalize leading prefixes. All twenty-four variants (bare + prefixed) pass now.

## Backlog Surgery

Pointed read-only agents at every runsheet and config, got back `BACKLOG.md` — 761 lines, 124 actionables, raw findings preserved (403 refs, 16 files, 864 KB, hashed).

Reviewed thirty runsheets. Kept the dead ends deliberately — the note saying PoE held 53.4V steady during restarts is negative evidence that stops the next person re-running a refuted theory. Cut 57 lines of genuinely dead syntax, cross-linked runsheets to the backlog. One VLAN-ID conflict across two audit reports turned out to be real: generated 42 minutes apart, straddling a renumber. Both correct.

Mirrored 38 starred GitHub repos into Forgejo for offline access. Lesson: `git remote update` in an uninitialized dir fails `no such file` — recover with clean `git clone --mirror` first, then reattach. NAS backups of the 3.9 GB mirror set stalled on CIFS/NFS perm + mtime semantics; `--size-only` fixed it, 32s → 1.77s incremental. Windows 1219s again — orphaned guest IPC$ from Explorer browsing, kill sessions before remapping.

Started sketching Planka as the task board. Security line already drawn: no execution authority in card text (anyone editing a card could escalate), perms live in root-owned host files only, workers run ephemeral with read-only mounts and `NoNewPrivileges=true`. Cards describe work. They don't grant it.
