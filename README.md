# OpenCode Context Reviewer

[![CI](https://github.com/timlaing/opencode-context-reviewer/actions/workflows/ci.yml/badge.svg)](https://github.com/timlaing/opencode-context-reviewer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/tag/timlaing/opencode-context-reviewer)](https://github.com/timlaing/opencode-context-reviewer/releases)
[![License](https://img.shields.io/github/license/timlaing/opencode-context-reviewer)](LICENSE)

[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=coverage)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)

[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=bugs)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=timlaing_opencode-context-reviewer&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=timlaing_opencode-context-reviewer)

TypeScript server plugin for OpenCode **V2**, compiled and tested against `@opencode/plugin` **2.2.0**. It redacts outgoing model context, automatically reduces large transcripts, and refuses requests it cannot safely process. No proxy, global fetch monkeypatch, external summarizer, telemetry, or plaintext secret registry.

## Install locally

Requires Node 22.18+ for the supplied tests, npm, and an OpenCode V2 installation compatible with SDK 2.2.0. From the extracted source ZIP directory:

```sh
npm ci --ignore-scripts
npm run build
npm test
```

Add this **directory's absolute path** to your project's `opencode.json` (merge with existing configuration):

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

Place this entry last so it sees changes from other plugins. Restart OpenCode and check that `context-reviewer` loaded successfully. Do not assume protection if OpenCode reports a plugin load/setup error. Configured V2 local paths name directories, not individual `.ts` files. The package exports prebuilt `dist/index.js`; rebuilding is required after source edits. An alternative is copying the entire built directory under `.opencode/plugins/context-reviewer/`; use only one loading method.

Releases publish `@timlaing/opencode-context-reviewer` to npmjs (with provenance) and to public GitHub Packages; see [Releases](CONTRIBUTING.md#releases). Until the first release exists, install from source as above. `npm pack` creates an installable package for transfer; extract it into a directory, run `npm install --ignore-scripts` there, and configure that directory as above. The package includes source and tests; the source ZIP additionally includes the dependency lockfile. Keep `package-lock.json` for reproducible dependency installation.

## Policy and behavior

Unknown options and invalid values reject setup. `policy.example.json` is an example for the options object; it is not automatically read. Changes take effect on plugin reload/restart. Keep actual sensitive literal values in private local configuration, outside version control.

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

The estimator counts serialized **UTF-8 bytes as a conservative token proxy**, including system instructions, tools and options. It is deliberately more aggressive than a characters/4 estimator; 24,000 here often means roughly 6,000 actual English tokens. It is not a provider tokenizer, measured billable usage, model context-window discovery, or a mathematical token bound for every tokenizer. Thresholds are input estimates; output limits and provider caches are unaffected.

Reduction occurs only above the threshold. It retains recent exchanges, expanding backward for crossing or outstanding tool calls; call IDs, names and namespaces remain unchanged. Orphans, duplicate IDs/results and mismatched tool names cause rejection. Earlier system-role messages remain system messages. The removed prefix becomes bounded, redacted excerpts in an ordinary **user** message labeled as lossy and untrusted. This is a deterministic local extractive summary, not a semantic model-generated summary: it may omit decisions, middle details, or old constraints. Original stored history is untouched. Every request recomputes from its draft, so no growing summary cache or cross-session transcript state accumulates.

If recent exchanges, system instructions and tool definitions cannot fit the target, the request is blocked instead of silently cutting recent data or breaking tool relationships. Use OpenCode's normal compaction or shorten input before retrying. The `compaction` hook redacts the entire source without automatic pruning, allowing OpenCode to produce its own checkpoint. `context`, `generate` and `title` apply both redaction and reduction. The plugin does not call a model to summarize.

## Redaction coverage

Built-in patterns cover common OpenAI/GitHub/AWS access-key forms, JWT-shaped tokens, PEM private keys, Bearer credentials, labeled password/secret/API-key/token assignments, and optionally emails/IPs. Add exact `literals` for organization-specific identifiers or credentials. Stable placeholders are keyed HMAC digests, with a random in-memory key per plugin instance. The same value gets the same placeholder in that instance; placeholders rotate on restart/reload and across instances. There is no reversible mapping or automatic secret rehydration. A model may consequently propose commands containing placeholders; do not expect those commands to authenticate.

System text, message text/reasoning, structured tool inputs/results, tool schemas/descriptions, options, and metadata string values are recursively inspected. Sensitive structured string fields such as `password` are wholly replaced, including whitespace. Schema keys and tool identities are never renamed: a detected secret in them blocks the request. Native provider state, encrypted/signed content, binary data, media, file URIs and unknown message part types are blocked. This intentionally limits attachments, some thinking-model transcripts, native compaction and stateful provider features. Benign fields named `data`, `uri`, `signature`, `encrypted`, or `native` can also cause rejection. This strict behavior has no fail-open toggle.

## Native HTTP and limits

V2 **does support** `ctx.session.hook("http.request", ...)` with a mutable Web `Request`. This plugin uses it as a last-mile **validator**, not a generic body rewriter. It parses bounded JSON (including JSON-escaped strings), rejects remaining detected secrets and opaque fields, and refuses non-JSON or content-encoded bodies. It catches detectable secrets introduced by raw body overlays or earlier HTTP hooks after draft redaction. The original request is not consumed or rewritten.

This hook wraps native session HTTP, including native HTTP fallback. It is **not universal raw HTTP interception**: third-party AI SDK transport, tools, MCP, shell commands, browser traffic, unrelated plugin `fetch`, telemetry, and other processes are outside this boundary. Provider credential headers are deliberately left intact and other headers are not redacted. URL scanning only detects the configured patterns; arbitrary query values are not a comprehensive URL policy. Use a controlled native HTTP route and network enforcement/proxy if complete egress DLP is required.

Stateful WebSocket handshakes are explicitly blocked: HTTP validation cannot inspect that transport's opaque/delta state. Select a native HTTP model route; this plugin does not promise automatic WebSocket-to-HTTP fallback. Later plugins can undo sanitization, replace HTTP requests after validation, or change hook behavior; load order and trusted plugins matter. Plugin failure/disablement and future OpenCode API changes are outside this plugin's enforcement boundary.

Pattern redaction cannot identify all secrets, PII, encoded/obfuscated content, or secrets split across messages. False positives are possible. It does not cleanse persisted session history, local files, logs written by OpenCode/other plugins, or provider data already sent before installation. Errors use a fixed message and never include raw payloads. Once a registered hook rejects, the verified host path propagates that error before dispatch; this is not a process-wide network kill switch.

## Validation

```sh
npm run check
npm test
```

Tests use actual 2.2.0 SDK message constructors and the compiled plugin. They cover stable/idempotent placeholders, nested credentials, all four model hooks, automatic reduction and summaries, tool boundary expansion, atomic failure, malformed/opaque payloads, native HTTP inspection, WebSocket refusal, registration and cleanup. Hook registration/dispatch is exercised with a mock host; there is no claim of a live provider or full OpenCode server end-to-end run. Review `API-VERIFICATION.md` for pinned source evidence.

## Guides

- [Configuration and options](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Development, verification and releases](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [API verification evidence](API-VERIFICATION.md)

## License

Licensed under the [MIT License](LICENSE).
