# Troubleshooting

Keep tokens, literal secret values and private configuration out of reports. The plugin's own errors are fixed strings and never contain payload data, so a redacted error excerpt is usually enough.

## The plugin does not load

Type checking passing does not demonstrate runtime discovery. Work through this list:

1. The configured path must be a **directory** (the checkout root or a copied built directory), not `src/index.ts`.
2. `dist/index.js` must exist. A fresh checkout has no build output:

   ```sh
   npm ci --ignore-scripts
   npm run build
   ```

3. Rebuild after every source edit; reload does not recompile TypeScript.
4. Load the plugin **last** so it sees changes from other plugins, and use only one loading method at a time.
5. Confirm OpenCode reports no load or setup error. Do not assume protection while an error is shown.

Verify discovery from the project directory used by the affected session:

```sh
opencode reload
opencode plugin list
opencode api GET /api/plugin --param "location[directory]=$PWD"
```

Look for `context-reviewer` with state `active` and any error details. If a reload leaves old code running:

```sh
opencode service restart
```

For loader errors, inspect the log or start a foreground instance:

```sh
rg 'context-reviewer|failed to load plugin' ~/.local/share/opencode/log/opencode.log
opencode --standalone --print-logs --log-level debug
```

During local development avoid running `npm ci` against dependencies used by an active OpenCode process — it removes `node_modules`. Stop that process or use an isolated checkout for clean-install verification.

## Requests fail with "Context reviewer blocked request"

`GuardError` has one fixed message:

```
Context reviewer blocked request: policy, payload, or budget could not be safely validated.
```

The message deliberately reveals nothing about the payload. Common causes, in the order they are usually hit:

| Cause                                   | Typical trigger                                                                                           | What to do                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Invalid options                         | Unknown key, `targetTokens >= thresholdTokens`, a literal shorter than 3 characters                       | Fix the options object; see [validation rules](configuration.md#validation-rules) |
| Oversized payload                       | Draft JSON above `maxPayloadBytes` (default 8,000,000; hard ceiling 50,000,000)                           | Raise the limit or shorten the input                                              |
| Cannot fit the budget                   | Recent exchanges plus system instructions plus tool definitions exceed `targetTokens`                     | Use OpenCode's compaction, reduce tool count, or raise both thresholds            |
| Broken tool boundaries                  | Orphaned tool results, duplicate call IDs/results, mismatched tool names                                  | Investigate the other plugin or extension that rewrote the message list           |
| Opaque or unknown content               | Parts named `native`, `encrypted`, `signature`, `data` or `uri`; unknown part types; binary/media content | Remove or replace that content — there is no fail-open toggle                     |
| Secret detected after earlier redaction | Another plugin or a raw body overlay introduced a credential into the HTTP body                           | Fix the source of the credential; the request is refused, not rewritten           |
| WebSocket model route                   | The provider connects over a stateful WebSocket                                                           | Select a native HTTP model route; this plugin does not fall back automatically    |

A rejected request stops before dispatch. It is not a process-wide network kill switch, and it is not a retryable transient error — fix the cause and resend.

## Reduction never happens

Reduction starts only above `thresholdTokens`, counted as serialized UTF-8 bytes (see [choosing thresholds](configuration.md#choosing-thresholds)). Requests below the threshold pass through with redaction only. The `compaction` hook never reduces; it only redacts.

## Attachments and thinking transcripts are rejected

File parts, media, native provider state and some thinking-model transcripts are opaque to inspection and are refused by design. This also applies to benign fields named `data`, `uri`, `signature`, `encrypted` or `native`. Use text-only messages, or drop this plugin for sessions that require those features.

## The model receives `[REDACTED_...]` instead of real values

Expected. Placeholders are keyed HMAC digests with a per-instance key: there is no reversible mapping, no rehydration, and the mapping rotates on restart. A model may propose commands containing placeholders; those commands will not authenticate. Keep the real values out of the model's context in the first place.

## Provider credentials still work

Provider credential headers are deliberately left intact, and other headers are not redacted — the plugin guards request **bodies**, not headers. See the [native HTTP boundary](../README.md#native-http-and-limits).

## What to include in a report

Include the repository revision, OS, OpenCode, Node and provider/model versions, the smallest reproduction, and a short redacted error excerpt. Omit full configuration files, `literals` values, environment dumps and session transcripts. Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/timlaing/opencode-context-reviewer/security/advisories/new) instead of a public issue — see [SECURITY.md](../SECURITY.md).
