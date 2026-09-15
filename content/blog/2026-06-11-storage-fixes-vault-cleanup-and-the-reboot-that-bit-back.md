---
title: "I Moved a Folder, Rebooted, and Home Assistant Forgot Who It Was"
date: 2026-06-11
category: Homelab
summary: "A USB storage quirk cut SSD latency from 4,864ms to 37ms. Later, one moved bind-mount directory made Home Assistant boot with an empty identity."
---
My 2TB external drive used to live at `/mnt/photos`. Since I don't have the real NAS hardware yet, I re-mounted it at `/mnt/tmpnas` as a general host share — updated `/etc/fstab`, pointed Immich's `UPLOAD_LOCATION` at the new path.

Then I carved two Samba shares out of it in `/etc/samba/smb.conf`: a guest read/write drop folder for anything on the LAN, and a password-locked one for my admin backups, reachable over Tailscale at `smb://x.x.149.70`.

## My T7 Was Choking on UAS

Immich started stalling on loads. `docker stats` showed `immich_server` pinned at 147% disk util with 25-second flush waits. Write latency at 4,864ms. That's not slow, that's dead.

`dmesg` was full of `uas_eh_abort_handler` timeouts on `/dev/sda`. The UAS driver just does not get along with this host controller + my Samsung T7 Shield combo. Kept aborting queued blocks.

Fix was a quirk. Added `usb-storage.quirks=04e8:61fb:u` to `GRUB_CMDLINE_LINUX_DEFAULT` in `/etc/default/grub` to force the T7 (`04e8:61fb`) onto plain `usb-storage`. Ran `update-grub`, rebooted. Write latency dropped from 4,864ms to 37ms. Night and day.

That reboot is where the real damage happened.

`ha.n5hq.me` started returning 400, and hitting port 8123 locally dropped me on a fresh onboarding wizard. My stomach sank.

Here's what I'd done to myself: before rebooting, I'd moved the live `/homeassisstant` directory (yes, with that typo, it's mine) into `/maybebin` while tidying root. On boot, Docker saw the bind-mount path was empty and helpfully created a fresh empty dir there. Home Assistant happily initialized a brand-new config into it — no proxy trust, no users, nothing.

My real 3GB instance was sitting untouched in `/maybebin` the whole time.

Stopped the container, moved the directory back, restarted the stack. Automations, integrations, tunnel — all back. Scared me enough to admit I still have no automated off-host backups for container volumes. Just uncommitted disk state. Need to fix that with actual vzdump/tar jobs.

Oh, and the reboot also killed my static dev server on port 3001, because I'd started it by hand with no supervisor like an animal. Added a `@reboot` line in crontab. It'll survive next time.
