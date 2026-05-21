---
title: "Why I built btrep: a zrepl-equivalent for btrfs"
description: "A story about backups, paranoia, and finding out that  \"just use `btrfs send`\" hides more complexity than anyone admits."
pubDate: "May 21 2026"
heroImage: "/btrepl_splash.webp"
badge: "New post"
tags: ["btrfs", "btrepl", "redundancy"]
---

## The night that started it

It was a Tuesday. I was rebuilding my homelab — three machines running btrfs, hosting things I actually care about: family photos, project archives, a Postgres instance for a side project, and an embarrassingly large collection of self-hosted services I keep promising myself I'll consolidate.

I had snapshots. I had hourly `btrfs subvolume snapshot` cronjobs. I felt clever. Then I pulled the power on the wrong machine while moving a desk, the SSD did something unkind, and I learned what every sysadmin eventually learns: **snapshots on the same disk are not a backup**.

The data survived, but the lesson landed. I needed replication — actual copies, on another machine, kept in sync, with retention I could reason about.

So I went looking for tooling.

## What was already out there

The btrfs world has options, and I tried them all in good faith.

**`btrfs send | ssh host btrfs receive`** is the foundation everything else is built on. It works. It's also a footgun: you have to track parent snapshots yourself, handle partial transfers, prune old snapshots on both sides, and write your own glue. Every homelab blog has a slightly different shell script, all of them subtly broken in different ways.

**`btrbk`** is the closest thing to a standard. It's well-maintained, it works, and for many people it's the right answer. But its configuration model is a single global config file with a particular philosophy about how snapshots and targets relate. When I tried to express "this subvolume goes to two different remote hosts with different retention policies, and one of them is bandwidth-constrained so throttle it," I ended up fighting the tool.

**`snapper`** is great at local snapshots but isn't really built for cross-host replication. Different problem space.

**`zrepl`** — and this is the one that broke me. zrepl is *beautiful*. It's a Go daemon, declarative YAML config, push/pull/sink jobs, real retention policies expressed as grids, prometheus metrics, structured logging. If you run ZFS, it's the right answer. I looked at it and thought: *why doesn't this exist for btrfs?*

I checked. It doesn't. There are GitHub issues asking for it going back years.

## The decision

I had two choices: switch everything to ZFS, or build the thing.

Switching to ZFS meant reformatting, and more importantly it meant giving up the btrfs features I actually use — cheap subvolume snapshots, transparent compression that just works, the ability to add and remove devices from a pool without ceremony. ZFS is wonderful but it's a different philosophy.

So I started building `btrep`.

The goal was specific: take the *shape* of zrepl — declarative config, push jobs, retention policies, robust handling of incremental sends — and build it on top of `btrfs send`/`receive` instead of `zfs send`/`receive`. Not a clone, but the same idea, ported to the other filesystem.

## What I learned about `btrfs send`

I thought I understood btrfs send/receive. I did not.

Here's what the man page tells you:

```bash
btrfs send /mnt/snapshots/data@2024-01-15 | \
  ssh backup-host btrfs receive /mnt/backups/data/
```

That works. Once. The interesting part is the *second* send, where you want to transmit only the changes:

```bash
btrfs send -p /mnt/snapshots/data@2024-01-15 \
              /mnt/snapshots/data@2024-01-16 | \
  ssh backup-host btrfs receive /mnt/backups/data/
```

The `-p` flag specifies the parent — the snapshot that already exists on the destination and that you're computing the delta against. Sounds simple. Here's what they don't tell you:

1. **The parent snapshot must exist, unchanged, on both sides.** If you pruned it on the source because retention said it was too old, your next incremental will fail. You have to coordinate retention with replication state.

2. **Read-only snapshots only.** `btrfs send` refuses to operate on read-write snapshots. Easy to forget when you're scripting.

3. **Partial transfers leave the destination in a weird state.** If `ssh` drops mid-transfer, you might have a half-received subvolume that `btrfs receive` won't let you resume. You have to detect it and clean up.

4. **UUIDs matter more than paths.** btrfs identifies snapshots by UUID internally. If you move a snapshot, rename it, or restore from a backup, the UUID changes and your replication chain breaks.

Every one of these became a bug I had to fix in btrep, usually after losing an evening to it.

## The shape of btrep today

I want to be honest about where the project is. btrep is **not** a finished product. Two things work well today: basic send/receive between hosts, and incremental snapshots with retention policies. That's it. Multi-target replication, a real daemon mode, prometheus metrics, push *and* pull modes — those are on the roadmap, but they're not done.

If you're looking for a polished drop-in replacement for btrbk, this isn't it yet. If you're interested in the design and willing to try something rough, read on.

Here's the config I run on my own server. Comments are mine, not part of the format:

```yaml
# /etc/btrep/config.yaml
source:
  subvolumes:
    - path: /mnt/data/photos
      snapshot_dir: /mnt/data/.snapshots/photos
    - path: /mnt/data/postgres
      snapshot_dir: /mnt/data/.snapshots/postgres

targets:
  - name: backup-nas
    type: ssh
    host: nas.lan
    user: btrep
    remote_path: /mnt/tank/backups/homelab

retention:
  # Keep snapshots on a "grid" — similar to zrepl's model.
  # The intent: dense recent history, sparse older history.
  keep:
    last: 24       # last 24 snapshots, no matter what
    hourly: 48     # one per hour for the last 48 hours
    daily: 14      # one per day for 14 days
    weekly: 8      # one per week for 8 weeks
    monthly: 12    # one per month for 12 months

schedule:
  snapshot_interval: 1h
  replicate_interval: 1h
```

You run it like this:

```bash
# Take a snapshot and replicate to all configured targets
btrep run

# Dry-run mode — shows what would be sent without sending
btrep run --dry-run

# Just snapshot, don't replicate
btrep snapshot

# Just replicate existing snapshots
btrep replicate
```

The output is intentionally boring. I've spent too much time deciphering "creative" CLI output from other tools:

```
$ btrep run
[14:00:01] snapshot: created /mnt/data/.snapshots/photos/2024-11-21-14-00-00
[14:00:01] snapshot: created /mnt/data/.snapshots/postgres/2024-11-21-14-00-00
[14:00:02] replicate: photos -> backup-nas (incremental, parent=2024-11-21-13-00-00)
[14:00:47] replicate: photos -> backup-nas done (sent 234 MiB in 45s)
[14:00:48] replicate: postgres -> backup-nas (incremental, parent=2024-11-21-13-00-00)
[14:01:12] replicate: postgres -> backup-nas done (sent 89 MiB in 24s)
[14:01:13] prune: photos kept 47 snapshots, removed 1
[14:01:13] prune: postgres kept 47 snapshots, removed 1
```

## The interesting design problems

A few things turned out to be harder than I expected, and I think they're worth writing down because the next person who tries to build something like this will hit them too.

### Tracking what exists where

The naive approach: list snapshots on source, list snapshots on destination, send anything missing. This breaks the moment you have any complexity — what if a snapshot exists on both sides but with a different UUID because someone restored from a backup? What if the source pruned a snapshot that the destination still has?

btrep keeps a small state file (just JSON for now, sqlite is on the list) tracking the UUID chain of what has been successfully replicated to each target. The source of truth is "what does the destination actually have," verified by listing remote snapshots, but the state file is what tells btrep "the last common parent was X."

### Choosing the parent for incremental sends

Given a set of snapshots on the source and a set on the destination, which one is the right `-p` argument for the next send?

The answer is "the most recent snapshot that exists on both sides with matching UUID." That sounds obvious until you realize you're comparing two lists across an SSH connection, parsing `btrfs subvolume list -u` output (which is mildly evil), and you really don't want to get it wrong because a wrong parent means a *full* resend.

I cache the destination's snapshot list per-run rather than per-subvolume because querying it is expensive on slow links.

### Retention that respects replication

If retention says "delete this snapshot" but it's the last common parent with a target, deleting it means the next replication is a full transfer. btrep's prune logic checks the replication state before deleting and will refuse to delete a snapshot that's still acting as a replication anchor. zrepl does the same thing — once I read its source code, I understood why.

## What's broken, and what's next

The honest list of what doesn't work yet:

- **No daemon mode.** btrep currently runs as a one-shot from cron or systemd timers. A long-running daemon with proper scheduling is planned.
- **Push only, no pull.** The source has to be able to SSH to the destination. Pull mode (destination pulls from source) is more secure for some setups and is on the list.
- **No metrics.** Prometheus endpoint is high on the priority list because I want to monitor my own backups.
- **No multi-target yet in the way I want.** You can configure multiple targets, but they're processed sequentially and share retention. Independent retention per target is coming.
- **Error recovery is "fail loudly and let cron retry."** Good enough for a homelab, not good enough for serious use.

## How you can help (if any of this resonates)

If you run btrfs on more than one machine and you've ever felt the friction I'm describing, I'd love to hear from you. The repo is at [github.com/your-username/btrep](#) — issues, ideas, and "here's how I do it" stories are all welcome. I'm especially interested in failure modes I haven't hit yet, because those are the bugs that bite people in production.

If you tried it and it broke, please tell me how. Boring bug reports are the most valuable thing you can give an early-stage project.

## A note on motivation

I'm writing this not because btrep is ready for prime time — it isn't — but because writing about what you're building forces you to be honest about it. When I started this post I had a draft that described btrep as "production-ready replication for btrfs." Reading it back, I deleted that line. It's not. It's a tool I trust with my own homelab, that I'm building in public, that solves a specific problem I had.

If you've been waiting for someone to build the zrepl of btrfs — I'm trying. Come help, or come watch, or come tell me I'm doing it wrong. All three are useful.

---

*btrep is open source under the MIT license. Built in Python because that's what I'm fastest in; a Go rewrite is a question for future-me when the design has stabilized.*