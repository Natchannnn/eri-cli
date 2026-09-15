---
title: "Moving 135GB of Photos and the USB Cable That Almost Killed Them"
date: 2026-06-28
category: Homelab
summary: "A 135GB Immich move nearly failed when the USB link began dropping under sustained load. A cable swap held 107 MB/s, and the source and destination counts matched."
---
Moved my Immich library off the bus-powered Samsung T7 Shield at `/mnt/tmpnas` onto my NAS pool at `/mnt/ugnas01-personal`. 135GB. Should've been boring.

Scope was small, thankfully. The T7 held the 135GB library plus two empty Samba shares in `/etc/samba/smb.conf`. Postgres and the ML models already live on my internal NVMe, so I only had to change `UPLOAD_LOCATION`, the bind-mounts, `/etc/fstab`, and Samba. Easy part.

Started the copy. NAS benchmarks over 190 MB/s. Actual transfer? Single files taking thirty seconds each.

`dmesg` told the story: the source ext4 on `/dev/sdb` had remounted `emergency_ro,shutdown` after I/O errors. The drive was falling off the USB bus and coming back as `005`, then `006`, then `007`. Just walking device numbers upward.

I assumed the NAND was dying. It wasn't. SMART said `PASSED`, 0% wear, zero reallocs. `fsck` just replayed the journal — all 121,599 files intact. The flash was fine. The cable + front port combo couldn't hold a sustained transfer.

Unmounted everything, swapped to a known-good cable straight into a rear motherboard USB 3.2 port. Rerun held a steady 107 MB/s, zero errors.

Stopped Immich for consistency, `rsync`'d, counted everything file by file because I didn't trust it anymore:
library 25,125 / 25,125. Thumbs 49,341 / 49,341. Encoded video, backups, upload profiles — all exact.

Repointed `UPLOAD_LOCATION`, brought the stack up. Healthchecks green, new uploads hitting the NAS pool directly.

Wiped the stale SSD data, `testparm`'d the Samba cleanup, removed the fstab entry. The NAS pool still has no parity and no off-host backup. That part keeps me up at night. Next job.
