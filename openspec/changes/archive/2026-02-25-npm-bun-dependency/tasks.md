## 1. Rewrite the af wrapper

- [x] 1.1 Replace `af` with a Node.js launcher script that uses `#!/usr/bin/env node`, resolves the Bun binary via `require.resolve('bun/package.json')`, and spawns it with `main.ts` and forwarded arguments
- [x] 1.2 Implement SIGINT and SIGTERM forwarding from the wrapper to the Bun child process
- [x] 1.3 Forward the child process exit code to the wrapper's exit code

## 2. Update package.json

- [x] 2.1 Add `bun` to `dependencies` with version `>=1.1.0`
- [x] 2.2 Lower `engines.node` from `>=22.6.0` to `>=16`

## 3. Verify

- [x] 3.1 Run `bun install` to install the `bun` dependency
- [x] 3.2 Run `node af --help` to verify the wrapper finds Bun and executes main.ts
- [x] 3.3 Run `node af demo` to verify Ink interactive components work through the wrapper
- [x] 3.4 Run `bun test` to verify existing tests still pass
