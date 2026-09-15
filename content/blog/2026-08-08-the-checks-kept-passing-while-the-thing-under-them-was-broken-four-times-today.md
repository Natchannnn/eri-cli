---
title: "The Checks Kept Passing While the Thing Under Them Was Broken, Four Times Today"
date: 2026-08-08
category: Homelab
summary: "Four checks passed while their assumptions were broken. The failures appeared during a 59-path vault move and another attempt to fence worker traffic."
---
Two jobs today: untangle the vault directory tree, and lock down worker egress. Both taught the same lesson — passing checks mean nothing if the check itself is broken. Four separate instances in one day.

## 59 Paths, Zero Links

04:23 instruction was explicit: verify every dependency before moving anything. Thirteen strays at the vault root — board docs, status files, research, a node plan, an audit, migration files, images, briefings, an orphaned stylesheet, dead README — plus mixed-case `projects/Network/`.

Good news: no Obsidian wikilinks to worry about. Everything cross-refs via prose mentions and literal paths. Bad news: 59 explicit path strings to update — 32 inside vault files, 15 from the board repo's doc-sync, 6 in repo docs, 4 in Python scripts, 2 in READMEs.

Two scripts would've failed silently. Doc-sync warns on missing sources but exits 0 — moved paths would've emptied mirrors without a peep. Two status loggers append output — stale paths would've spawned orphans at the old root, no errors. Patched and verified both first: sync with zero warnings, tree sweep resolving every ref. Then moved sixteen files — board docs to `projects/n5-board/`, hypervisor plans to `projects/proxmox-pve01/`, audits to `projects/homelab-audit/`, images to `projects/network/`, `Network/` lowercased, briefings to `research/`, dead stuff to `archive/`. Root is `CLAUDE.md` + directories now.

04:54 codified it in `CLAUDE.md`: root holds only `CLAUDE.md` and dirs, a filing index for every artifact type, project dirs record live status (live / superseded / parked / abandoned), filesystem-wide search before any move. Added a status registry for nine personal project dirs so I stop targeting dead mirrors. Found a legacy `@reboot` cron pointing at a retired path and a fossil hardware inventory — cataloged for later.

## plankamd: 193 Tests, Two Live Bugs

Background worker generalized the tool to `plankamd` — 60 files, 193 tests, 91% coverage. Adversarial review still found a live logic bug in the private repo's `generate.py`: anything not in Backlog got forced back to Backlog, steamrolling user card moves in real use.

Security pass: zero lab IDs across 60 files, but two publish blockers. Backlog parser regex had quadratic ReDoS — 9.12s on 40k trailing spaces. And `generate` skipped the redaction filter, printing pasted creds despite docs promising otherwise. Patched both, widened CommonMark markers, suite now 240 green. Forgejo push verified by SHA. GitHub mirror failed HTTP 500 — PAT missing `workflow` scope for `.github/workflows/ci.yml`. Again that scope.

Board lockouts mid-day: laptop blocked at the container — Planka + Postgres healthy, but DOCKER-USER only allowed three hosts and Tailscale routing disagreed. Then auth failed — creds read from a stale staging folder on the primary host instead of the live container env. Pulled the real env file off the container: HTTP 200, session token. Desktop wired block fixed with an explicit ACCEPT above DROP, verified by reading iptables chains, not trusting daemon reload.

## Egress: Fail Open Is a No

Main event was worker egress. Started with nftables uid allowlists. Namespace testing killed it: socketless kernel packets (v6 ND, invalid-state TCP resets) skip uid matching, hit default drop — host-wide connectivity at risk. Plus `nft add element` on existing entries returns success without refreshing lease timeouts. Dynamic entries expire early while reporting fine. That's failure modes three and four for the day's theme.

13:31 pivoted to a local proxy: nftables pins workers to loopback-to-proxy + static LAN only, proxy does domain allowlisting, DNS leaves the worker env entirely. Evaluated two proxies — one fails open on missing directives or unset ports, the other denies by default in every test. Took the fail-closed one despite its startup capability requirements.

Final round: DNS as unprivileged user still resolved over an unmapped channel. My "blocked by construction" assumption was wrong. And `requisite=` unit failures in systemd never reach failed state — proxy daemon could die with no alert firing.

Stopped 23:26 with no prod deploy. Proxy packages and service accounts still uninstalled. Egress lockdown waits on root provisioning.

Side notes: Web3 briefing finished at 8,625 words / 14 tables after I rejected draft one for missing citation tags. Nightly maintenance held a VPN minor + photo container for manual review (breaking APIs), five routine updates went clean, one ML container restart flagged for RCA.
