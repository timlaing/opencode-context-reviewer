# Contributing

Use a feature branch and open a pull request into `main`. Keep changes focused and credentials out of issues, logs and examples.

## Development

Requires Node.js 22.18 or later; CI pins Node.js 24. In a checkout separate from a running OpenCode instance:

```sh
git clone https://github.com/timlaing/opencode-context-reviewer.git
cd opencode-context-reviewer
npm ci --ignore-scripts
npm run build
```

`--ignore-scripts` is deliberate — keep using it. Load the checkout's absolute path as a plugin entry (see [configuration](docs/configuration.md#loading-the-plugin)) to verify changes against a real OpenCode V2 runtime, and rebuild after every source edit. Do not commit live configuration, `.npmrc` files, tokens, `dist/` or generated archives.

Use the repository's configured no-reply email and GPG key for signed commits. Check `git log -1 --show-signature` before pushing.

## Verification

```sh
npm run check    # tsc --noEmit typecheck
npm run build    # emit dist/
npm test         # build + node --test --experimental-strip-types test/*.test.ts
npm run test:coverage   # same suite with an LCOV report in coverage/lcov.info
```

There is no lint or formatter. Tests use actual 2.2.0 SDK message constructors and the compiled plugin: stable/idempotent placeholders, nested credentials, all four model hooks, reduction and summaries, tool boundary expansion, atomic failure, malformed/opaque payloads, native HTTP inspection, WebSocket refusal, and registration/cleanup. Hook registration and dispatch run against a mock host — there is no live-provider or full OpenCode server end-to-end run, and pull requests must not claim one. `API-VERIFICATION.md` records the pinned upstream evidence; re-verify and update it whenever `@opencode/plugin` or `@opencode/ai` moves off `2.2.0`.

GitHub CodeQL default setup scans JavaScript/TypeScript and Actions workflows. Keep CodeQL enabled when maintaining branch protection.

## Project structure

```
opencode-context-reviewer/
├── src/
│   ├── index.ts     # Plugin entry: registers the six hooks, in order
│   ├── guard.ts     # Redaction, reduction and HTTP inspection
│   └── policy.ts    # Option validation and GuardError
├── test/
│   └── guard.test.ts
├── scripts/
│   └── publish-github-packages.mjs   # GitHub Packages release mirror
├── docs/
│   ├── configuration.md
│   └── troubleshooting.md
├── policy.example.json   # Documentation only; never read at runtime
└── API-VERIFICATION.md   # Pinned upstream hook/transport evidence
```

## Conventions

`AGENTS.md` holds the rules that matter: errors never contain payload data, `transform` is atomic, the plugin fails closed with no escape hatch, and the `compaction` hook redacts without reducing. Keep behavioral changes reflected in `README.md` and `docs/`.

## Submitting changes

1. Create a feature branch: `git checkout -b my-feature`
2. Make your changes
3. Run `npm run check` and `npm test`
4. Commit with a conventional commit message: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:`
5. Push and open a pull request

Pull request titles must also use Conventional Commits; the `conventional pull request title` workflow rejects anything else. Fill in the pull request template, especially the validation commands and the compatibility section.

## Labels and triage

Issue forms set `bug` or `enhancement` and `needs-triage`. Automation adds a component label from the bug form. Maintainers remove `needs-triage` after review and can adjust labels manually. PRs receive labels from changed paths, conventional title prefixes (`fix:`, `feat:`, `docs:`, `ci:`, `test:`, `build:`), and Dependabot authorship. Automatic labels are additive and preserve manual labels.

## Stale issues and pull requests

The daily stale workflow marks issues with no activity for 60 days and pull requests with no activity for 30 days, then closes them after a further 14 days. Draft PRs, items with milestones, and items labeled `keep-open`, `security`, or `priority: high` are exempt. Stale closure does not indicate a fix; items can be reopened and stale PR branches are retained.

## Dependency updates

Dependabot opens weekly grouped PRs for GitHub Actions and npm dependencies. CI runs `npm audit --omit=dev` on every pull request as the `npm dependency vulnerabilities` check; only `@opencode/plugin` and `@opencode/ai` ship to users, so the runtime tree is the release surface that check guards.

## Branch protection

The intended branch protection for `main` is: PRs only, one approving review, dismissal of stale approvals, approval after the latest push by someone other than its author, resolved review threads, the `Plugin types and tests` job passing against an up-to-date branch, linear history, no force pushes or deletion, and no bypass actors. Review requires a second person; PR authors cannot approve their own changes.

Inspect Settings → Rules → Rulesets for the currently enforced checks and reviews, and apply or adjust the intended policy there. Keep required check names synchronized with CI when jobs are renamed or removed.

Squash/rebase merging and automatic deletion of merged branches are enabled in repository settings. The `npm dependency vulnerabilities` and SonarQube checks are not required checks in the ruleset.

## SonarQube analysis

The `SonarQube` workflow runs alongside `CI` on main pushes and pull requests. It installs the toolchain, runs the tests with coverage itself, then scans and waits for the quality gate. It is skipped until the repository has the `SONAR_ENABLED` Actions variable set to `true`, and it fails loudly when that variable is set but `SONAR_TOKEN` is missing. `sonar-project.properties` documents the same source/test layout for local analysis; run `npm run test:coverage` first, because it builds the `dist/` sources the scan analyzes.

Project: `timlaing_opencode-context-reviewer`, organization: `timlaing`, service: `https://sonarcloud.io`. Create or import the public Sonar project with that key, supply its CI token as the `SONAR_TOKEN` Actions secret, then set `SONAR_ENABLED=true`. Disable Sonar automatic analysis when using this CI workflow. Repository visibility alone does not create or enable a Sonar project.

Issue exclusions for the generated `dist/` output (ten `javascript:` rules scoped to `dist/**`) are configured in the SonarCloud project settings under Analysis Scope → Issue Exclusions → "Ignore Issues on Multiple Criteria", because SonarCloud does not apply the scanner-side `sonar.issue.ignore.multicriteria` property. Recreate them there if the Sonar project is ever rebuilt; the exact rule list is documented in `sonar-project.properties`.

## Releases

Releases are event-driven — publishing never happens on pushes to main:

1. Ensure `main` is green.
2. `gh release create vX.Y.Z --target main --generate-notes`
3. The `Publish release` job in the `CI` workflow triggers on the release event, verifies the tag points into `main`, runs the suite on the tagged tree, stamps the tag version into `package.json` (never committed), publishes `@timlaing/opencode-context-reviewer` to npmjs via trusted publishing (OIDC with provenance), and mirrors the same version to GitHub Packages.
4. Re-running the job is safe — both publishes skip versions that already exist.

One-time setup before the first release:

- On npmjs.com, add a **trusted publisher** for `@timlaing/opencode-context-reviewer`: owner `timlaing`, repository `opencode-context-reviewer`, workflow filename `ci.yml`. The filename binding is why the publish job lives in `ci.yml` — do not move it to another workflow file without reconfiguring npm.
- GitHub Packages needs no configuration beyond the repository's own `GITHUB_TOKEN`.

Published versions are immutable. Only stable `vX.Y.Z` tags are released; anything else fails the job.
