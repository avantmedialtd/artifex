---
name: "Release"
description: Cut an npm release — pick the version, write proper notes, bump, tag, push, and follow the build to published
category: Workflow
tags: [release, workflow, npm]
---

Cut an `@avantmedia/af` release end to end: choose the version bump, synthesize
proper release notes from what actually shipped, write them to a versioned file,
get explicit approval, then bump `package.json`, commit, tag, push, and follow the
build to a published npm package and GitHub Release.

**Input**: none. The release type is chosen interactively (with a suggestion).

**Where this runs**: the **primary checkout, on `master`** — *not* a worktree.
Feature work lands on `master` first; `/release` is the deliberate exception that
runs from the main repo to ship what has landed.

**Key fact**: `package.json`'s `version` is the npm source of truth — npm publishes
exactly that value. The tag is derived from it, and `.github/workflows/release.yml`
asserts they match before publishing. So the release commit must carry both the
bumped `package.json` and the notes file.

---

## Steps

### 1. Preflight (master-only safety)

Run these read-only checks first. **Hard-fail** (stop, do nothing) on the first;
**confirm-through** (surface the condition, require an explicit yes via
AskUserQuestion) on the rest.

```bash
git rev-parse --abbrev-ref HEAD          # must be: master   → else HARD FAIL
git status --porcelain                   # non-empty = dirty  → CONFIRM
git fetch origin --quiet
git rev-list --left-right --count origin/master...master   # right (ahead) > 0 → CONFIRM
gh run list --branch master --workflow ci.yml --limit 1 --json conclusion,status   # not success → CONFIRM
```

- **Not on `master`** → HARD FAIL: "Releases run from the primary checkout on `master`."
- **Dirty tree**, **local `master` ahead of `origin/master`**, or **latest master CI
  not green** → show the specific condition and ask to continue (Continue / Cancel).
- The target **tag already exists** (checked in step 4 once the version is known) → HARD FAIL.

### 2. Resolve the current version and the release window

The current version is `package.json`'s `version` (not the tags):

```bash
node -p "require('./package.json').version"          # e.g. 0.0.18
LAST_TAG=$(git tag -l 'v*' --sort=-creatordate | head -1)   # may be empty on the first release
```

- **If `LAST_TAG` is set**: the window is `git log "$LAST_TAG"..HEAD`.
- **First release (no `v*` tag yet)**: fall back to the window since the last
  manual version bump and say so in the plan — e.g.
  `git log "$(git log --grep='Increment version' -1 --format=%H)"..HEAD --oneline`.
  Keep the first notes concise; don't try to summarize the entire project history.

Gather the changes archived in that window — they are the spine of the notes:

```bash
git log "$LAST_TAG"..HEAD --diff-filter=A --name-only -- openspec/changes/archive/
```

For each archive directory **added** in the range, read its `proposal.md` (the level-1
title + the **Why** lines). Note any that added a new `specs/<capability>/` directory.

### 3. Choose the release type (with an inferred suggestion)

`af` is pre-1.0 (`0.0.x`), so default to **patch**. Suggest **minor** only when the
window is a notable milestone (several new capabilities, or the user wants to mark
one). Never auto-suggest **major** (the 1.0 call is a human milestone).

Ask with **AskUserQuestion**, suggested option first and labelled `(suggested)`,
e.g. from `0.0.18`:

- **Patch (suggested)** → `v0.0.19` — N changes, fixes & improvements
- **Minor** → `v0.1.0` — mark a milestone / K new capabilities
- **Major** → `v1.0.0`
- *Other* → an explicit `x.y.z`

**Decline prerelease input.** If an explicit version carries a `-rc`/`-beta` suffix,
stop and explain prerelease versions aren't supported (final `x.y.z` only) —
`bump-version.ts`'s regex and the workflow's `make_latest: true` both assume final
releases.

### 4. Resolve the target version

```bash
bun run bump <type> --dry-run        # prints: v0.0.18 -> v0.0.19   (writes nothing)
```

Parse the right-hand side as the target tag (e.g. `v0.0.19`). Confirm the tag does
not already exist (HARD FAIL from step 1 if it does):

```bash
git rev-parse -q --verify "refs/tags/v0.0.19" && echo EXISTS
git ls-remote --tags origin "v0.0.19"
```

### 5. Synthesize the notes

Curate — do **not** dump commit subjects. Use the archived proposals as the spine
and `git log "$LAST_TAG"..HEAD --oneline` for bare commits, rewriting imperative
subjects into user-facing voice. Group into the sections below (omit any empty
section), then append the Install footer **with the real version substituted** and a
generated compare link.

```markdown
af v0.0.19

<optional one-line theme of the release>

## ✨ Highlights
- **<Feature>** — <what it does for the user>.

## 🔧 Improvements
- <smaller enhancement / polish>.

## 🗑 Removed
- <user-visible removal>.

## 🩹 Fixes
- <bug fix>.

---

### Install

```bash
npm install -g @avantmedia/af      # new install
npm update  -g @avantmedia/af      # upgrade
```

**Full Changelog**: https://github.com/avantmedialtd/artifex/compare/<lastTag>...v0.0.19
```

On the first release (no prior tag), drop the compare link or point it at the first
commit, and note it's the inaugural tagged release.

### 6. Write the notes file (no mutation yet)

Write the synthesized notes to **`releases/<tag>.md`** (the name carries the leading
`v`, e.g. `releases/v0.0.19.md`). Do **not** `git add`/commit/tag/push yet — this is
just a file on disk so it can be reviewed and edited.

### 7. Approval gate

Show a release plan and the **fully rendered notes**, then ask with
**AskUserQuestion**: **Proceed / Edit / Cancel**.

```
Release plan
  Version:  0.0.18 → 0.0.19   (<type>, suggested: <yes/no>)
  Ref:      master @ <sha>    <preflight result inline>
  Window:   <N> commits · <K> archived changes
  Notes:    releases/v0.0.19.md

This bumps package.json, commits the bump + notes, tags v0.0.19, and triggers the
npm publish + GitHub Release. Proceed?
```

- **Edit** → take the user's wording changes (or let them edit the file), rewrite
  `releases/<tag>.md`, and re-present the gate.
- **Cancel** → stop. Leave the uncommitted notes file on disk (a later run can reuse
  it). Nothing was bumped, tagged, or pushed.
- **Proceed** → step 8.

### 8. Bump, commit, tag, push (only after approval)

```bash
bun run bump <type>                      # rewrites package.json version
git add package.json releases/<tag>.md
git commit -m "Release <tag>"
git tag -a <tag> -m <tag>                # annotated tag on the release commit
git push origin master --follow-tags     # sends the commit and the tag together
```

### 9. Follow the build to published — or recover

The tag push triggers `.github/workflows/release.yml` (guards → CI gates → `npm
publish --provenance` → GitHub Release). Follow it:

```bash
gh run watch "$(gh run list --workflow release.yml --branch <tag> --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

- **Success** → report the published package (`npm view @avantmedia/af version`) and
  the Release URL (`gh release view <tag> --web`).
- **Failure** → report the failing job (`gh run view <id> --log-failed`) and offer
  recovery via AskUserQuestion:
  1. **Re-run the workflow** — the publish step is resumable (it skips an
     already-published version and still creates the Release).
  2. **Delete the tag and re-release the same version** —
     `git push origin --delete <tag>` + `git tag -d <tag>`, fix, re-run `/release`
     (only if nothing was published yet).
  3. **Ship a follow-up patch** — fix forward and release `<tag+patch>`.

---

## Guardrails

- **Nothing mutates before the approval gate.** Up to step 7 the only side effect is
  writing `releases/<tag>.md` on disk; all `git`/`gh`/`npm` calls are read-only.
- **Runs on `master` in the primary checkout** — never a worktree branch.
- **`package.json` is the version source of truth.** The bump commit must include it;
  the workflow rejects a tag whose value disagrees with `package.json`.
- **Curate, don't dump.** The value over auto-notes is editorial: user-facing voice,
  grouped sections, real highlights.
- **Final releases only.** Decline `-rc`/`-beta`; the workflow's `make_latest: true`
  assumes final `x.y.z`.
- **The notes file name carries the leading `v`** so it matches `github.ref_name` and
  the workflow's `body_path: releases/${{ github.ref_name }}.md`.
- **Substitute the real version** into the Install footer and the compare link — no
  `<version>` placeholders in the published body.
- **One-time prerequisite**: the `NPM_TOKEN` secret must exist
  (`gh secret set NPM_TOKEN`) or the publish step fails. This is set up once, outside
  this command.
