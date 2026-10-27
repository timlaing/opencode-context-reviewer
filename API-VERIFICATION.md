# API verification — 2026-10-27

## Published package

`npm view @opencode/plugin version` returned **2.2.0**. Downloaded the published tarball and installed that exact SDK; package-lock pins the dependency graph. The implementation compiles against its declarations without an invented hook shim.

Relevant installed files:

- `node_modules/@opencode/plugin/dist/promise/plugin.d.ts`: `Plugin.define({ id, setup(ctx) })`; setup receives `ctx.options` and may return cleanup.
- `node_modules/@opencode/plugin/dist/promise/session.d.ts`: `context`, `compaction`, `generate`, `title`, `http.request`, and `experimental.ws.handshake` exist. Request drafts expose `system`, `messages`, `options`; context variants additionally expose `tools`. HTTP event exposes mutable `request: Request`.
- `node_modules/@opencode/ai/dist/schema/messages.d.ts`: message `content` includes tool-call and tool-result parts. Both identify the relationship with **`id` and `name`**, not assumed V1/AI-SDK `toolCallId` fields. Messages use SDK constructors to retain their runtime class shape.
- `node_modules/@opencode/plugin/dist/promise/adapter.js`: session hook callbacks are wrapped in `Effect.promise(() => Promise.resolve(callback(event)))`. Rejections are defects, not a typed cancellation API; there is no local catch that turns them into successful hook completion.

Tarball: `https://registry.npmjs.org/@opencode/plugin/-/plugin-2.2.0.tgz`

## Current upstream implementation

Read upstream `dev` at commit **618b89066773e707601577230ba7211605c8b569**. This is source-path confirmation, not a claim that every installed OpenCode binary uses that commit.

- [Hook registry](https://github.com/anomalyco/opencode/blob/618b89066773e707601577230ba7211605c8b569/packages/core/src/plugin/hooks.ts): callbacks run sequentially; trigger yields callback effects and propagates defects. Session hooks expose no typed failure channel.
- [Model request preparation](https://github.com/anomalyco/opencode/blob/618b89066773e707601577230ba7211605c8b569/packages/core/src/session/model-request.ts): primary maps to context; compaction/generate/title have separate drafts. `http.request` trigger precedes `handler(sent)`; returning the same Request preserves the original body. A replaced Request is lowered back to the native transport. HTTP hooks also cover native HTTP fallback. WebSocket hooks run separately.
- [WebSocket transport](https://github.com/anomalyco/opencode/blob/618b89066773e707601577230ba7211605c8b569/packages/core/src/session/model-transport.ts): handshake interception occurs before connection selection/opening; send frames and provider checkpoint state are separate from HTTP. Rejecting handshake prevents this path from proceeding.

The plugin's negative tests verify its hook callbacks reject before a mock send. A complete server/provider integration run remains unverified; deployments must confirm compatible OpenCode versions and native route behavior before relying on it.

## Official documentation checked

- [V2 plugin layout/loading](https://opencode.ai/v2/docs/build/plugins/): default export and directory-based local package entries.
- [Server hooks](https://opencode.ai/v2/docs/build/plugins/server/): request kinds, native HTTP scope, sequential hook order and late raw overlays.
- [V1 migration](https://dev.opencode.ai/v2/docs/build/plugins/migrate-v1): `plugins` configuration, directory paths, `@opencode/plugin` and V2 registration. V1 hook names are not used.
