# Configuration

The plugin is configured entirely through the `options` object in your OpenCode configuration. It reads no files at runtime: `policy.example.json` in this repository is documentation only and is never loaded.

## Loading the plugin

Requires Node 22.18+ and an OpenCode V2 installation compatible with SDK 2.2.0. Build first — the package exports `dist/index.js`, which does not exist in a fresh checkout:

```sh
npm ci --ignore-scripts
npm run build
```

Add the plugin to your project's `opencode.json` using this directory's **absolute path** (merge with existing configuration):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-context-reviewer",
      "options": {
        "thresholdTokens": 24000,
        "targetTokens": 16000,
        "recentExchanges": 4,
        "summaryChars": 4000,
        "maxPayloadBytes": 8000000,
        "literals": [],
        "redactEmails": true,
        "redactIPv4": false
      }
    }
  ]
}
```

Place this entry last so it sees changes from other plugins. Restart OpenCode and confirm that `context-reviewer` loaded successfully; do not assume protection if OpenCode reports a load or setup error.

Local paths name **directories**, not individual `.ts` files. Two equivalent loading methods:

- Point at the checkout root (as above), after `npm run build`.
- Copy the entire built directory under `.opencode/plugins/context-reviewer/` and reference that path.

Use only one loading method at a time. Rebuild after every source edit — reloading does not recompile TypeScript.

### Published packages

Releases publish `@timlaing/opencode-context-reviewer` to npmjs (with provenance) and to GitHub Packages. Until the first release exists, install from source as above, or use `npm pack` to create an archive for transfer: extract it, run `npm install --ignore-scripts` in the extracted directory, and configure that directory as above. Keep `package-lock.json` for reproducible dependency installation.

## Options

Unknown options and invalid values reject setup — there is no partial configuration.

| Option          | Default | Meaning                                                                                 |
| --------------- | ------- | --------------------------------------------------------------------------------------- |
| thresholdTokens | 24000   | Start automatic reduction above this estimated input budget                             |
| targetTokens    | 16000   | Required estimated maximum after reduction; must be below threshold                     |
| recentExchanges | 4       | Minimum recent user-started exchanges retained in full                                  |
| summaryChars    | 4000    | Maximum characters in local excerpt summary                                             |
| maxPayloadBytes | 8000000 | Maximum draft/wire JSON size accepted                                                   |
| literals        | []      | Additional exact, case-sensitive strings to redact, longest first; minimum 3 characters |
| redactEmails    | true    | Redact email-like addresses                                                             |
| redactIPv4      | false   | Optionally redact IPv4-shaped addresses (may include false positives)                   |

### Validation rules

Setup rejects when any of the following hold:

- `options` is missing, not a plain object, or contains a key that is not in the table above.
- `thresholdTokens`, `targetTokens`, `recentExchanges`, `summaryChars` or `maxPayloadBytes` is not a safe integer of at least 1.
- `targetTokens` is greater than or equal to `thresholdTokens`.
- `recentExchanges` exceeds 100, `summaryChars` exceeds 100000, or `maxPayloadBytes` exceeds 50000000.
- `literals` is not an array, holds more than 1000 entries, or contains anything other than strings of at least 3 characters.
- `redactEmails` or `redactIPv4` is not a boolean.

A rejected setup surfaces the plugin's fixed error message; it never contains your option values.

### Choosing thresholds

The estimator counts serialized **UTF-8 bytes as a conservative token proxy**, including system instructions, tools and options. It is deliberately more aggressive than a characters/4 estimator; 24,000 here often means roughly 6,000 actual English tokens. It is not a provider tokenizer, measured billable usage, model context-window discovery, or a mathematical token bound for every tokenizer. Thresholds are input estimates; output limits and provider caches are unaffected.

Raise `thresholdTokens` and `targetTokens` together (keeping `targetTokens` below `thresholdTokens`) if reduction triggers too early. Lower them if requests still exceed the provider's context window. Reduction runs on every request from the current draft, so changing options takes effect on reload without any migration.

## Behavior

### Reduction

Reduction occurs only above `thresholdTokens`. It retains `recentExchanges` recent user-started exchanges, expanding backward for crossing or outstanding tool calls; call IDs, names and namespaces remain unchanged. Orphans, duplicate IDs/results and mismatched tool names cause rejection. Earlier system-role messages remain system messages.

The removed prefix becomes bounded, redacted excerpts in an ordinary **user** message labeled as lossy and untrusted. This is a deterministic local extractive summary, not a semantic model-generated summary: it may omit decisions, middle details, or old constraints. `summaryChars` caps its size. Original stored history is untouched, and every request recomputes from its draft, so no growing summary cache or cross-session transcript state accumulates.

If recent exchanges, system instructions and tool definitions cannot fit `targetTokens`, the request is blocked instead of silently cutting recent data or breaking tool relationships. Use OpenCode's normal compaction or shorten the input before retrying.

### Hook coverage

| Hook                        | Reduces | Notes                                                                                 |
| --------------------------- | ------- | ------------------------------------------------------------------------------------- |
| `context`                   | yes     | Main model requests                                                                   |
| `generate`                  | yes     | Generation requests                                                                   |
| `title`                     | yes     | Title generation                                                                      |
| `compaction`                | no      | Redacts the entire source without pruning, so OpenCode can produce its own checkpoint |
| `http.request`              | no      | Last-mile validator over the native HTTP body                                         |
| `experimental.ws.handshake` | —       | Always rejects: opaque delta state cannot be inspected                                |

The plugin never calls a model to summarize.

### Redaction and literals

Built-in patterns cover common OpenAI/GitHub/AWS access-key forms, JWT-shaped tokens, PEM private keys, Bearer credentials, and labeled password/secret/API-key/token assignments, plus optionally emails and IPv4 addresses.

Add exact, case-sensitive strings to `literals` for organization-specific identifiers or credentials. Entries are matched longest-first and must be at least 3 characters. Keep real values in private local configuration, outside version control — see [the security policy](../SECURITY.md).

Placeholders are keyed HMAC digests with a random in-memory key per plugin instance: the same value maps to the same placeholder while the plugin runs, and placeholders rotate on restart, reload and across instances. There is no reversible mapping and no automatic secret rehydration.

### Load order

The plugin must be the last entry so it sees changes made by other plugins. Later plugins can still undo sanitization, replace an HTTP request after validation, or change hook behavior: load order and trusted plugins matter. Plugin failure or disablement and future OpenCode API changes are outside this plugin's enforcement boundary.

## Example policy file

`policy.example.json` mirrors the options object above:

```json
{
  "thresholdTokens": 24000,
  "targetTokens": 16000,
  "recentExchanges": 4,
  "summaryChars": 4000,
  "maxPayloadBytes": 8000000,
  "literals": ["replace-with-your-private-project-name"],
  "redactEmails": true,
  "redactIPv4": false
}
```

Copy the values into your `opencode.json` options object; the plugin will not read this file for you.

## Scope and limits

Read [README.md](../README.md) for the full redaction coverage, native HTTP boundary and WebSocket behavior, and [troubleshooting.md](troubleshooting.md) for diagnosis.
