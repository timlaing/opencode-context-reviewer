# Security policy

## Reporting a vulnerability

This repository and its issues are public. Do not put vulnerability details, credentials, private keys, literal secret values, personal data or sensitive deployment information in public issues, pull requests or discussions.

Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/timlaing/opencode-context-reviewer/security/advisories/new).
This route is available to first-time reporters and sends the report privately to
repository maintainers. Do not use a public issue as a substitute.

No response-time guarantee or older-release support commitment is offered.
Security fixes target the current development branch and the latest releases;
upgrade when a fix is published.

## Plugin boundaries

The plugin redacts detectable secrets from outgoing model context and refuses requests it cannot safely process. Keep that in mind when relying on it:

- Pattern redaction is best effort. It cannot identify all secrets, PII, encoded or obfuscated content, or secrets split across messages, and false positives are possible.
- The `literals` option holds real secret values. Keep them in private local configuration, outside version control, and never paste them into an issue or example.
- Placeholders are keyed HMAC digests with a per-instance key. There is no reversible mapping and no rehydration, so a model may emit placeholders that do not authenticate — that is intended.
- It does not cleanse persisted session history, local files, logs written by OpenCode or other plugins, or provider data already sent before installation.
- The `http.request` hook validates native session HTTP bodies only. Third-party AI SDK transports, tools, MCP, shell commands, browser traffic and telemetry are outside that boundary, and provider credential headers are deliberately left intact.
- WebSocket handshakes are refused outright, and opaque or unknown message parts block the request. This is fail-closed by design with no escape hatch.
- Later plugins can undo sanitization or replace requests after validation. Load order and trusted plugins matter; plugin disablement and future OpenCode API changes are outside this plugin's enforcement boundary.

Dependency audits and updates complement review; passing audits are not a claim that the code has no vulnerabilities.
