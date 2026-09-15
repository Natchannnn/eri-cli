---
title: "I Built a Downloads Sorter in Six Hours and Every Bug in It Looked Like Working Code"
date: 2026-07-29
category: Projects
summary: "Developing FileIt-a robust PowerShell downloads organizer-debugging .NET exception unwrapping and wildcard expansion bugs, and validating edge cases via Windows Sandbox."
---
Wanted a Downloads sorter for Windows 11 that doesn't eat half-downloaded files. Built FileIt in about six hours. Every bug in it passed casual testing and only died on real filenames. That's the whole story, really.

Warmed up on backups first: thirty-one containers' named volumes (DBs, telemetry, n8n flows). Two gotchas. GNU `tar` `--exclude` is positional — put it after the file operand and it's silently ignored. I was archiving live DB locks into a 1.3 GB tarball. Moved excludes before targets: 230 MB. And SQLite WAL mode can't snapshot off a read-only mount — opening needs `-shm` sidecars, throws `SQLITE_CANTOPEN`. Switched to `sqlite3 <db> ".backup <dest>"` from read-write container context, all eight verified with `PRAGMA integrity_check`. Added a mountpoint guard so a dropped NAS mount aborts instead of backing up an empty dir and calling it success.

## The Sorter

Stateless scheduled task every 15 minutes, no resident watcher to die on reboot. Age gate: only touch files with `LastWriteTime` older than 60 minutes, so in-flight downloads survive.

Test corpus was 118 real filenames I'd transcribed — 31 extensions plus case variants (`.PDF`), 27 with spaces, some with no extension at all, `&` `+` commas square brackets, sparse multi-gig ISOs, nested dirs.

Four bugs, all subtle:

`Move-Item -Destination` expands `[ ]` as wildcards. `-LiteralPath` only covers the source. Files with brackets went to wrong places. Replaced with `[System.IO.File]::Move($source, $destination)`. Literal, always.

Catching `[System.IO.IOException]` on collisions never fired. PowerShell wraps .NET throws in `MethodInvocationException`. Have to catch that and inspect inside:

```powershell
catch [System.Management.Automation.MethodInvocationException] {
    if ($_.Exception.InnerException -is [System.IO.IOException]) { ... }
}
```

Volume check via `[System.IO.Path]::GetPathRoot()` is string math — doesn't resolve NTFS junctions. Category folders on junctions crossing disks sailed past the "same volume, atomic move" guard. Now I explicitly reject `FileAttributes.ReparsePoint`.

Installer crashed with null refs. Loop var was `foreach ($l in $list)`, script-level config hashtable is `$L`. PowerShell variables are case-insensitive. The loop ate my config. Renamed iterators, audited every `$L`-adjacent name.

## Sandbox Harness

18 tests inside Windows Sandbox — one command, ephemeral instance, codebase mapped read-only, runs under stock PowerShell 5.1. Test 15 (230-char filename) failed on fixture setup: sandbox profile path is 72 chars, total blew past Win32 260 (`306 > 260`). Harness now sizes strings off runtime cwd length. Mutation-tested it too — disabled collision renaming, bypassed the age gate, emptied ignore lists — each broke exactly its assertions. 2,000 synthetic files with 60 collisions sorted in 2.4s.

Before publishing I found proprietary filenames baked into early fixtures. Replaced with 118 synthetic names matching extension/length/special-char distributions, squashed history to one clean commit, `git reflog expire --expire=now --all` + `git gc --prune=now --aggressive`, deleted and recreated the GitHub repo via API so detached hashes die in the object cache. Anonymous clone: 22 files, zero leaks.

Bonus tool: screenshot sorter that reads magic bytes, not extensions. HTML error pages saved as `.png` go to review queue instead of polluting the media archive.
