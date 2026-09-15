---
title: "I Asked If My Containers Were Up to Date and Ended the Day Running My Own Git Forge"
date: 2026-07-24
category: Homelab
summary: "Building an automated container and host update pipeline with n8n, debugging a silent bash parameter expansion defect in change evaluation, and deploying an LTS Forgejo git forge."
---
Finished a routine pass over thirty containers + host packages and thought: I'm not hand-reading changelogs every day. Built an n8n pipeline on port 5678 to triage updates — auto-apply, postpone, or ping me on Discord with a changelog summary for breaking majors and sketchy deps.

Logic lives in `~/bin/` shell scripts so I can test outside the UI. sudoers pins exact binary paths, no wildcards. First integration bug: everything downstream of the Discord webhook never ran. Discord returns empty HTTP 204 on success — my JSON parser got null and died. Had to branch on status code, not payload.

## The Bash Brace That Ate Every Patch

Validated against eleven pending host packages. Judge called all of them low-risk point releases. Pipeline said `skip` on all eleven. No errors, no Discord pings. Looked perfectly operational while doing absolutely nothing.

Culprit, one line:

```bash
PAYLOAD="${JUDGE:-{}}"
```

I meant "empty JSON object if JUDGE is empty." Bash meant: default value is the string `{`, then append a literal `}`. So valid judge output `{...}` became `{...}}`. `jq` choked, pipeline fell back to safe-default `skip`. Silently.

Fixed to:

```bash
PAYLOAD="${JUDGE:-null}"
if ! echo "$PAYLOAD" | jq -e 'type == "object"' >/dev/null 2>&1; then
  # Explicit error logging
fi
```

Now it validates shape before branching and actually logs. Patches flow again.

## Found Two Corpses in Inventory

Swept the environment, found an ancient cron binding a dead web root and a legacy reverse proxy squatting on 80/443 with no backends. Deleted both.

Also built a docs watcher so docs stop rotting: host daemon tails `docker events --filter 'event=create'`, waits 60s to debounce batches, scrubs tokens/env out of `docker-compose.yml`, regenerates stack reference docs. Catches both raw `docker compose` runs and Portainer deploys.

## The Handheld Dongle Was Just Missing a Driver

That 2.5GbE USB-C dongle on the handheld from last week — I blamed VLAN filtering. Wrong. Sweeps showed zero link pulses, zero DHCP discovers. Port stayed link-down across auto, forced 2.5G, forced 1G. Clean OS image with no Realtek driver — controller never initialized. Also had to reset neg overrides on a five-port gigabit switch I'd unplugged earlier.

Side experiment: local OCR script pulling sixteen fields off photographed work orders across three form layouts, zero key errors, correctly ignored junk control images. Forms aren't standardized yet in production, so I stopped the daemon and archived it with its systemd units. Later.

## Forgejo

Needed local git for private infra scripts and runsheets, so I deployed Forgejo (the Gitea fork). Requirement: don't break Vercel deploys that hook off GitHub. So Forgejo is authoritative, with push mirrors to private GitHub repos keeping the webhooks alive.

Mirrors failed with HTTP 500 at first — SSH on 2222, remote host keys missing from `/etc/ssh/ssh_known_hosts`. Populated, syncs started. Daily dumps go to the NAS NFS store — first one 433 MB, healthchecks passing.

Two minutes after Forgejo came up, my docs watcher detected the new stack and wrote its service doc to disk unprompted. Pipeline works.
