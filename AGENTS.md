# AGENTS.md

## What this is

OpenCode **V2** server plugin (`opencode-context-reviewer`): redacts outgoing model context, reduces oversized transcripts, blocks requests it cannot safely process. Fail-closed by design — every rejection throws `GuardError`.

Source is only 3 files:

- `src/index.ts` — plugin entry. Registers exactly 6 hooks, in this order: `context`, `generate`, `title`, `compaction`, `http.request`, `experimental.ws.handshake` (the last always throws). A test asserts this exact list; adding/removing hooks requires updating `test/guard.test.ts`.
- `src/guard.ts` — all redaction, reduction, and HTTP inspection logic.
- `src/policy.ts` — option validation and `GuardError`.

## Commands

```sh
npm ci --ignore-scripts   # --ignore-scripts is deliberate; use it
npm run check             # tsc --noEmit typecheck (no lint or formatter exists)
npm run build             # tsc -> dist/ (tests run against dist/, not src/)
npm test                  # build + node --test --experimental-strip-types test/*.test.ts
npm run test:coverage     # same suite + coverage/lcov.info for SonarQube
```

Requires Node >= 22.18 (`--experimental-strip-types`). Typecheck with `npm run check` (`npx tsc -p tsconfig.json --noEmit`).

Run a single test (build first — tests import `../dist/*.js`):

```sh
npm run build && node --test --experimental-strip-types --test-name-pattern "<name substring>" test/guard.test.ts
```

## Conventions that matter

- **Errors never contain payload data.** `GuardError` has one fixed message matching `/blocked request/`. Keep it that way; tests assert on it.
- **`transform` is atomic.** It must not mutate the draft until fully validated (it commits `system`/`messages`/`options` only at the end). Tests verify the draft is byte-identical after a throw — preserve this.
- **Fail closed, no toggles.** Opaque fields (`native`, `encrypted`, `signature`, `data`, `uri`), unknown part types, oversized payloads, and WebSocket handshakes all reject. Do not add a fail-open escape hatch.
- **`compaction` hook redacts but does not reduce** (`reduce=false` in `index.ts`); the other three model hooks do both. Keep this distinction.
- `policy.example.json` is documentation only — it is never read at runtime. Actual options come from the plugin's `options` in `opencode.json`; unknown or invalid options reject setup.

## Dependencies

`@opencode/plugin` and `@opencode/ai` are pinned to **exact** `2.2.0` (no caret). The implementation is verified against that SDK's declarations — see `API-VERIFICATION.md` for pinned upstream evidence (hook registry, model request prep, WebSocket transport). If you bump the SDK, re-verify hook names/shapes against the new declarations and update `API-VERIFICATION.md`.

Tests use real SDK constructors (`Message.user(...)`, `Message.tool(...)` from `@opencode/ai/effect`) against the **compiled plugin**, with a mock host for hook registration — there is no live-provider or full-server test. Don't claim end-to-end coverage.

## Docs

`README.md` is the authoritative user documentation (options table, redaction coverage, HTTP/WebSocket boundaries). `docs/configuration.md` and `docs/troubleshooting.md` are the user guides; `CONTRIBUTING.md` covers CI, branch protection, SonarQube and the release process. Keep behavioral changes reflected in all of them, plus `policy.example.json` when options change.

## Repository layout

- `.github/workflows/ci.yml` — the `Plugin types and tests` job (required check) and the release-triggered `publish` job. The npmjs trusted publisher is bound to the filename `ci.yml`; moving the publish job requires reconfiguring npm.
- `scripts/publish-github-packages.mjs` — GitHub Packages mirror, dry-run by default (`--publish` to publish).
- Coverage is measured on `dist/` (tests import `../dist/*.js`), so `sonar-project.properties` analyzes `dist`, not `src`. Never point Sonar at `src` without also changing how tests load the plugin.
