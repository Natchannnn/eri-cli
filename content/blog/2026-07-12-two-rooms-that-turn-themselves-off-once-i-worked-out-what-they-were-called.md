---
title: "Two Rooms That Turn Themselves Off Once I Worked Out What They Were Called"
date: 2026-07-12
category: Homelab
summary: "I used recorder history to choose a five-minute vacancy timeout, cleaned up an old firewall rule, and made a CSS change I could not yet see."
---
Sunday afternoon, three unrelated jobs: occupancy automations in HA, an ISP-migration audit on the gateway, and portfolio CSS I couldn't actually look at.

## How Long Is Empty?

Wanted auto-off for the theatre (two downlights + two strips) and the office. Didn't want to guess the timeout, so I queried HA's SQLite recorder for the mmWave sensor's raw history.

Pattern was clear: false-negative dropouts up to two minutes when someone sits still, real vacancies twenty-five minutes plus. Set vacancy timeout to five minutes — safely above the two-minute noise floor, won't leave lights burning for an hour. Real-world delay is that plus the sensor's own hardware cooldown.

## HA Didn't Know What Anything Was Named

Office auto-off needs four entities: two downlights, desk lamp, air purifier. Finding them was stupid.

The purifiers show up under two domains — a `fan` entity and a `switch` entity — labeled only `big` and `small` with OEM IDs. Only way to tell them apart was `area_id: office` vs `area_id: lounge`. The theatre presence sensor had a device-tracker still named after the next room over. Had to join device registry to area registry to find the right ID.

Did it carefully because bad YAML crashes the daemon: snapshot `automations.yaml` with a timestamp, append the blocks, run `ha core check_config` in the CLI container, restart HA, query SQLite to confirm `automation.theatre_lights_off` and `automation.office_lights_off` are live.

## I Can Switch ISPs Without Touching DNS

Audited every external dependency in case I move ISPs onto dynamic IPs or CGNAT. Turns out I have zero inbound bindings:

- public web in via Cloudflare Tunnels (`cloudflared`, outbound TLS on 443)
- node/admin traffic over Tailscale
- seedbox mounts over outbound `sshfs`
- portfolio on external CDN

No A/AAAA records point at my WAN. Switching ISPs is just new PPPoE/VLAN tags on the WAN port. No DNS changes, no DDNS updater. Nice surprise.

Found one dead port-forward from before the tunnel days — high WAN port to a host that's been repurposed since. Deleted it.

## CSS I Couldn't See

Evening: styling audit on the portfolio worktree serving port 3003. Linter complaints were legit — small metadata text at 3.82:1 on dark bg, fails AA's 4.5:1. Bumped hsl lightness, worst case now 4.77:1. Missing canonicals + OpenGraph on all seventeen templates. And reveal classes setting `opacity: 0` inline, so with JS off everything below the hero is invisible — added `<noscript>` overrides.

Problem: no headless Chromium or Playwright on that box. So I replaced the high-saturation glows with desaturated inset highlights and never actually saw them. Linters pass, HTML valid, 200s everywhere. Whether it looks good is unverified. Refactoring presentation through static parsers alone feels wrong, but that's where I left it.
