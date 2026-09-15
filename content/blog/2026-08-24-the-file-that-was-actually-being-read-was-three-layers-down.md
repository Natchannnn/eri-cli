---
title: "The File That Was Actually Being Read Was Three Layers Down"
date: 2026-08-24
category: Homelab
summary: "Resolving configuration hierarchy and stdin exhaustion in network-controller plugins, diagnosing recurring NAS interface flapping, and observing backup no-touch windows."
---
Network controller integration kept throwing 403s on init. Edited the standalone config file twice. Nothing changed. Because the runtime never read that file — the plugin loads an inline config block cached inside its own module directory, which wins over external paths. Found it by tracing startup paths instead of configs. Updated the inline block, 403 gone.

Then login failed with empty creds. An early cache-warming step read `stdin` to prime state, swallowing input before auth ran. Credentials never reached the handshake. Reordered init so warming happens after auth. Login completed.

Two failures, both the same shape: the thing being read wasn't the thing I was editing.

## My NAS Blinks Twice a Day

Storage logs showed the NAS interface dropping link 60–90s at ~07:02 and ~11:49, daily. Thirty days back, both timestamps, every day. First guess was DHCP renewal timing out. Correlation says the opposite: link loss comes first, DHCP fails because there's no interface to renew on. Symptom, not cause. Same switch, other endpoints: zero link transitions in those windows. Fault is the appliance, not the wire. Low-level kernel logs need admin access I don't have, so root cause stays open.

Hardened the clients meanwhile: `nofail` on the `/etc/fstab` entries so reboots don't hang on mounts, fsck pass `2` → `0` so net mounts skip local boot checks. Verified with `findmnt --verify`.

Paused the storage-auth project over it. New handshakes on an interface that drops twice daily just add failure modes without fixing the physical flapping.

## The Backup Window Almost Got Violated

Verification pass over 17 operational claims: a systemd backup timer documented but absent, one utility confirmed dead, several probes flapping unreported. And at 01:04 an automated task fired inside the nightly no-touch window (01:00–05:30). The agent read the schedule, saw the restriction, halted with zero host modifications. The one time the guardrail earned its keep. Left everything alone and logged it.
