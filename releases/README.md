# Release notes

One Markdown file per release, named for its tag **including the leading `v`** —
`v0.0.19.md`, `v0.1.0.md`, and so on. The name matches `github.ref_name` exactly,
so the release workflow renders the GitHub Release body straight from
`releases/${{ github.ref_name }}.md` with no path munging.

These files are authored by the **`/release`** command, not by hand: it
synthesizes user-facing notes from the OpenSpec changes archived since the last
tag (plus `git log` for bare commits), shows them for approval, then commits the
file **alongside the version bump** and tags that commit. Pushing the tag triggers
`.github/workflows/release.yml`, which publishes `@avantmedia/af` to npm (with
provenance) and uses this file as the Release body — GitHub's auto-generated notes
are off.

Each file is self-contained: curated highlights grouped into
`✨ Highlights / 🔧 Improvements / 🗑 Removed / 🩹 Fixes` (empty sections omitted),
then an **Install** footer (`npm install -g @avantmedia/af`) and a Full-Changelog
compare link.
