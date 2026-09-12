---
title: "FileIt: Building a PowerShell Downloads Sorter, Windows Sandbox Harness, and Safe Repository Sanitization"
date: 2026-07-29
category: Projects
summary: "Developing FileIt—a robust PowerShell downloads organizer—debugging .NET exception unwrapping and wildcard expansion bugs, and validating edge cases via Windows Sandbox."
---
Engineering an automated file organizer requires handling edge cases that typical test suites miss: partial downloads in flight, NTFS junction points, case-insensitive variable scoping, and wildcard expansion in path resolution. This post documents the implementation of FileIt—a PowerShell utility for categorizing Downloads folders—alongside creating an automated Windows Sandbox testing environment and securing homelab Docker volume backups.

## Docker volume backups and SQLite WAL snapshot mechanics

Prior to starting application development, I finalized an automated backup pipeline for the primary server's thirty-one Docker containers. Named volumes store critical runtime state, including database records, monitoring telemetry, and orchestration workflows.

The initial backup script exposed two critical storage mechanics:
1. **Positional Tar Arguments**: GNU `tar` treats `--exclude` flags as strictly positional. Placing exclusion patterns after the file operand causes `tar` to ignore the filters entirely, packing active ephemeral database locks into the archive. Moving exclusion arguments ahead of target directory operands dropped archive size from 1.3 GB to 230 MB.
2. **SQLite WAL Concurrency**: Attempting to snapshot SQLite databases configured in Write-Ahead Logging (WAL) mode via a read-only filesystem mount triggered intermittent `SQLITE_CANTOPEN` failures. Opening a WAL-mode database requires creating or accessing shared memory (`-shm`) sidecar files. The script was updated to execute `sqlite3 <db> ".backup <dest>"` from within read-write container contexts, validating all eight snapshots with `PRAGMA integrity_check`.

A mountpoint guard was added to abort execution if the remote NAS mount drops, preventing the backup script from generating false-positive archives in an unmounted local directory.

## FileIt architecture and a hostile test corpus

FileIt was designed to organize cluttered Downloads folders on Windows 11 into clean categories without disrupting active transfers.

To prevent moving files mid-download, the engine implements an age gate: files are only processed if their `LastWriteTime` exceeds 60 minutes. Rather than relying on continuous memory-resident filesystem watchers (which fail silently across reboots), the tool operates as a stateless scheduled task executing every 15 minutes.

To build a rigorous test suite, I transcribed 118 real filenames from historical download directories into a test fixture. The corpus captured diverse filesystem edge cases:
- Thirty-one distinct file extensions (including case variants like `.PDF`).
- Twenty-seven filenames containing whitespace.
- Files lacking extensions entirely.
- Filenames containing special characters: `&`, `+`, commas, and square brackets (`[`, `]`).
- Sparse multi-gigabyte ISO archives and nested subdirectories.

## Debugging four subtle PowerShell runtime bugs

Validating the script against the test corpus surfaced four discrete runtime defects:

1. **Move-Item Wildcard Expansion**: In PowerShell, `Move-Item -Destination` automatically interprets square brackets as regex wildcard characters. Because `-LiteralPath` only applies to source paths, destination paths containing brackets routed files to unintended paths. I replaced the cmdlet with a direct .NET method invocation (`[System.IO.File]::Move($source, $destination)`), ensuring literal string handling.
2. **Exception Unwrapping**: Catching `[System.IO.IOException]` failed to trigger when handling filename collisions. PowerShell wraps underlying .NET runtime exceptions inside `System.Management.Automation.MethodInvocationException`. Catch blocks were updated to inspect the inner exception object:
   ```powershell
   catch [System.Management.Automation.MethodInvocationException] {
       if ($_.Exception.InnerException -is [System.IO.IOException]) { ... }
   }
   ```
3. **NTFS Junction Traversal**: To ensure moves remain atomic within a single physical volume, the script initially validated volume roots via `[System.IO.Path]::GetPathRoot()`. Because `GetPathRoot` executes string manipulation without resolving filesystem reparse points, category folders mapped to directory junctions crossing physical disk boundaries bypassed the check. I updated the validation to explicitly detect and reject reparse points (`FileAttributes.ReparsePoint`).
4. **Case-Insensitive Variable Collision**: Within the installer UI loop, defining `foreach ($l in $list)` silently clobbered the script-level layout configuration hashtable `$L` because PowerShell variable names are case-insensitive. Renaming loop iterators and establishing a script-wide variable naming audit resolved the null reference crash.

## Windows Sandbox automated test harness

To validate FileIt on clean Windows environments without manual workstation testing, I implemented an 18-test validation harness executed inside Windows Sandbox. A single command spawns an ephemeral Windows instance, maps the codebase read-only, and executes the suite under native Windows PowerShell 5.1.

- **MAX_PATH Limitations**: Test 15—which validates long-path handling using a 230-character filename—initially failed during fixture initialization. Because the Sandbox user profile path was 72 characters long, total path length exceeded the 260-character Win32 API ceiling (`306 > 260`). The harness was updated to dynamically size test strings based on runtime working directory length.
- **Mutation Testing**: The suite was verified by deliberately introducing regressions (disabling collision renaming, bypassing the 60-minute age filter, and emptying ignore lists). Each mutation triggered exact corresponding test assertion failures.
- **Performance Benchmark**: The pipeline processed 2,000 synthetic test files with 60 sequential name collisions in 2.4 seconds, confirming predictable scaling.

## Sanitizing test fixtures and scrubbing Git history

Before publishing FileIt to a public GitHub repository, an audit revealed that early test fixtures contained proprietary and personal filenames.

To sanitize the codebase:
- Replaced the fixture with 118 synthetically generated filenames replicating the exact extension distribution, length profiles, and special character combinations.
- Reset the git history to a single clean initial commit, preventing old filenames from persisting in historical git tree objects.
- Flushed local reflogs and expired remote-tracking references:
  ```bash
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
  ```
- Deleted and recreated the remote GitHub repository via API, ensuring detached commit hashes could not be retrieved from upstream git object caches. An anonymous clone verified a clean 22-file tree with zero sensitive references.

## Content-based magic byte sorting

In addition to extension-based routing, I implemented a dedicated utility for screenshot sorting. The tool reads initial file header magic bytes rather than file extensions. This prevents misnamed files—such as HTML error pages downloaded with a `.png` extension—from being filed into media archives, isolating corrupt payloads into an explicit review queue.
