---
title: "A Second Server in the Morning, an Open Front Door by Midnight"
date: 2026-07-28
category: Homelab
summary: "The second Proxmox node survived a live link failure with no lost pings. Hours later, an audit found an unauthenticated webhook exposed to the internet."
---
Big day: killed single points of failure. New Dell OptiPlex 3070 Micro (i5-9500T, 16 GB, 256 GB NVMe) as second Proxmox VE 9.2.5 host at `x.x.0.20`, bonded networking, Home Assistant out of Docker into its own HAOS VM. Ended the night finding an open front door I didn't know I had.

## The Bond That Saved Me From a Loose USB Plug

`vmbr0` wouldn't bind on first boot. Opened it up — the USB 2.5GbE NIC wasn't seated. Pushed it in, link came up.

That looseness is exactly why I bonded: `bond0` active-backup, Realtek USB 2.5GbE primary, onboard Intel I219-LM 1GbE standby. Killed the primary with `ip link set <dev> down` mid-ping — zero loss. Came back, bond re-promoted 2.5GbE automatically. `iperf3` held 2.35 Gbps both ways vs 944 Mbps on gigabit alone.

## Then I Broke the Primary Server the Same Way

Got confident, tried bonding the primary too. Plugged its onboard gigabit into the switch. Cross-VLAN died instantly. Management VLAN + SSH fine, but Home/IoT/Camera all gone — HA lost plugs, Hue bridge at `x.x.1.182`, cameras, everything.

Routing table showed it: the onboard NIC still had legacy DHCP. It grabbed `x.x.0.201` on carrier, installed a default route at metric 100, stomping the static 2.5GbE default at 1024. Outbound inter-VLAN packets left with source `x.x.0.201`, UniFi dropped them on default inter-VLAN rules.

Two more self-inflicted wounds on top: my 120-second rollback watchdog (reverts net config unless I touch a confirm file) expired at 08:09 before I committed — reboot at 08:14 loaded the old unbonded config. And editing net files in `nano` padded every line with trailing whitespace, 551 bytes → 808 bytes. In whitespace-sensitive configs that's asking for silent parse failures. Switched to staging in scratch + `install -m 644`. Rebooted 08:45 with a MAC pin on the bond, single default route on `x.x.0.5`. Cross-VLAN came back.

## HAOS Move Took Ten Minutes, DAD Took Longer

Migrated HA from Docker to a dedicated HAOS VM on `pve02` — supervisor, add-ons, USB passthrough. Cutover 11:25:05 to 11:35:26, ten minutes. Old container stopped, kept cold.

Guest kept dropping its static IP to link-down. Logs inside:

```text
NetworkManager: ipv4: duplicate address detected for x.x.0.x on interface eth0
```

I'd picked an IP already owned by an AP. APs don't show in DHCP lease tables (infra, not clients), so I missed it. Full ARP ping sweep, found a free one, assigned. First 2.25 GB backup finished in 49 seconds.

At 15:37 I yanked power by accident doing rack work. Primary host cold-dropped. Reboot 15:40:23 actually validated everything for real: net watchdog clean, NAS mounts up before Docker (photo server didn't bind empty dirs), 31 of 32 containers back, all tunnel endpoints green. Best test is the one you don't plan.

## The Webhook With No Lock

Afternoon read-only audit found it: my package-triage approval webhook. It takes human callbacks before running upgrades/reboots. URL had an internal token, but it was publicly exposed through the proxy with no identity check. Any crawler could've hit it and triggered host restarts.

Moved it behind Cloudflare Access immediately — 24-hour sessions, verified identities only, internal API path unchanged.

Evening noise: 35 Wi-Fi clients dropped for 2 seconds, gateway load spiked to 38.72. Kuma recorded 1,761 clean ICMP heartbeats across thirty targets, zero loss, wired hosts untouched. Controller reporting daemon stalled, forwarding plane never blinked. Gateway mem 90–95% looks scary but it's active + page cache; six-day drift 0.29%, no leak. Declined to put RC firmware on my edge router. Stable stays.

Reviewed 37 proposed UniFi tweaks with reviewers — approved 10, killed the rest. IGMP snooping died when airtime showed multicast under 6%. A claim that `RadioChannelLockedByIot` never existed died against my own morning logs where I cleared it. And a transcript search returning nothing turned out to be dirnames starting with `-` eaten by `grep` as flags — `--` separator brought back 185 matches. Verified mDNS changes in the UI after the API lied `success` while leaving DB values untouched, killed dead VPN services and unused helpers. Called it at midnight.
