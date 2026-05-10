## Context

`af` ships as a thin Node shim (`af`) that spawns `bun main.ts` with the user's arguments. There is no compile or bundle step — TypeScript source files are executed directly by Bun. The package metadata in `package.json` is therefore present at runtime in the same directory tree as the source, both during local development and after `bun install -g @avantmedia/af`.

The current router has no awareness of global flags before command dispatch, and the help banner emitted by `commands/help.ts` does not include any version information. There is no existing helper that reads from `package.json` at runtime.

## Goals / Non-Goals

**Goals:**

- Provide a single, authoritative `getVersion()` helper that returns the version string declared in `package.json`.
- Add `--version` and `-v` as top-level flags that print the version and exit `0`.
- Surface the version in the `af help` banner and the no-args help invocation.
- Avoid any duplication of the version string in source code.

**Non-Goals:**

- Comparing the installed version against the npm registry to surface "newer available" hints. This is a separate, future concern (Tier 2 in earlier discovery).
- A `version` subcommand — `--version` is the conventional and sufficient surface.
- A self-update command — out of scope.
- Per-subcommand `--version` flags. Only the top-level form is supported.

## Decisions

### Read `package.json` via Bun's native JSON import

Use `import pkg from '../package.json' with { type: 'json' }` inside `utils/version.ts`. The TypeScript config already sets `resolveJsonModule: true`, and Bun supports JSON import attributes natively, so no runtime work or build step is required.

Alternatives considered:

- **Disk read with `readFileSync` + `JSON.parse`**, anchored at `dirname(import.meta.dirname)` (the same anchor used in `utils/resources.ts`). Works, but adds error surface (file-not-found, JSON parse) for a value that is part of the published package and effectively cannot be missing. The import form is shorter and gives TypeScript the type of the parsed object for free.
- **Inline the version at build time.** Rejected — there is no build step and introducing one for a single string would be disproportionate.

### `--version` / `-v` handled as an early branch in `router.ts`

Before any subcommand parsing, check `args[0] === '--version' || args[0] === '-v'`, print the version, and return `0`. This mirrors the convention used by virtually every CLI and avoids interleaving with subcommand option parsing.

Alternatives considered:

- **A `version` subcommand.** Rejected — `--version` is the conventional UX and what users will type by reflex.
- **Allow `--version` anywhere in the arg list.** Rejected — adds complexity (which subcommand "owns" it?) for no clear win.

### Version line at the top of the help banner

`commands/help.ts` prepends a single line `af v<version>` to the banner before the `USAGE:` block. Same source — the new `getVersion()` helper.

### Output format

`af --version` prints exactly the version string followed by a newline (e.g. `0.0.14\n`). No `v` prefix, no extra text. This is machine-parsable and matches `node --version`-style minimalism. The help banner uses the human-friendly `af v0.0.14` form.

## Risks / Trade-offs

- **`package.json` becomes a runtime artifact.** It is already shipped because npm includes it by default, and the `files` allowlist does not need to mention it explicitly. Risk is negligible but worth noting; if `files` were ever rewritten to be stricter, `package.json` must remain reachable.

- **Bun's JSON import attribute syntax (`with { type: 'json' }`) is comparatively new.** The Node shim only spawns Bun, so no Node version is asked to parse this file directly. Runtime support is guaranteed by the existing Bun >=1.1 dependency declared in `package.json`.

- **Tooling that treats `package.json` as code may be confused.** Some linters or type-check passes may emit warnings for the import attribute. Mitigation: confirm `bun run lint` and `bun run format:check` pass during implementation; adjust ignore rules only if a real false positive appears.
