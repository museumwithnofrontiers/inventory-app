# Workflows

The `/.github/workflows` directory contains GitHub Actions workflows for continuous integration, deployment, and automation tasks.

## Table of contents

- [Workflows](#workflows)
  - [Table of contents](#table-of-contents)
  - [Notes](#notes)
  - [Continuous Integration and Testing](#continuous-integration-and-testing)
    - [CI](#ci)
    - [Dependency Audit (Full Tree)](#dependency-audit-full-tree)
  - [Continuous Deployment](#continuous-deployment)
    - [Build](#build)
    - [Deploy to OVH](#deploy-to-ovh)
    - [Deploy Documentation to GitHub Pages](#deploy-documentation-to-github-pages)
    - [Deploy Dataset Viewers to OVH](#deploy-dataset-viewers-to-ovh)
  - [Automation Workflows](#automation-workflows)
    - [Dependabot Configuration](#dependabot-configuration)
    - [Merge Dependabot PR](#merge-dependabot-pr)
  - [Composite Actions](#composite-actions)
  - [Workflow Dependencies](#workflow-dependencies)
  - [Contributing](#contributing)

## Notes

- **Every workflow runs on GitHub-hosted runners** (`ubuntu-latest`, `ubuntu-24.04`); no self-hosted runner is used any more
- **Python workflows** use Python 3.x on Ubuntu runners for documentation generation
- Most workflows use **concurrency groups** to prevent duplicate runs and conserve resources
- Workflows are triggered by push events, pull requests, schedules, other workflow runs (`workflow_run`), or manual dispatch (`workflow_dispatch`)
- Repeated setup steps are factored out into **composite actions** under [`.github/actions`](../actions) — see [Composite Actions](#composite-actions)
- Several workflows interact with scripts in [/scripts/README.md](../../scripts/README.md)

## Continuous Integration and Testing

### CI

Runs the pull request validation pipeline: an unconditional dependency review, plus lint/build/test jobs that are gated on which paths changed. Jobs are skipped when no relevant files were modified. Provides the `CI Success` status check required by branch protection rules.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `continuous-integration.yml` |
| **Workflow name** | `CI` |
| **Trigger** | Pull requests to `main` branch (opened, synchronize, reopened) |
| **Manual trigger** | No — CI gates pull requests and has no meaning outside one (`dependency-review` only supports `pull_request`, and path detection needs a PR base SHA) |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Concurrency** | Group: `ci-mandatory-${{ github.ref }}`, cancel-in-progress: `true` |

**Path groups and triggered jobs**

| Changed paths | `detect-changes` output | Jobs triggered |
| --- | --- | --- |
| `app/**`, `routes/**`, `config/**`, `database/**`, `tests/**`, `bootstrap/**`, `composer.json`, `composer.lock`, `phpunit.xml`, `artisan` | `backend` | `backend-lint`, `backend-tests` |
| `resources/css/**`, `resources/js/**`, `resources/views/**`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js` | `root-frontend` | `backend-rendered-frontend-validation` |
| `scripts/importer/**` | `importer` | `importer-validation` |
| `scripts/site-i18n/**` | `site-i18n` | `site-i18n-validation` |
| `scripts/exporters/**` | `exporters` | `exporter-validation` |

**Jobs**

1. **detect-changes** (*Detect Changed Paths*) - Classifies changed files using `git diff` against the PR base SHA
   - Checks out the repository with full Git history (`fetch-depth: 0`)
   - Emits outputs: `backend`, `root-frontend`, `importer`, `site-i18n`, `exporters` (true/false)
   - Also emits `exporter-datasets`, a JSON array of every directory under `scripts/exporters/` holding a `package.json`, used as the `exporter-validation` matrix

2. **dependency-review** (*Dependency Review (PR)*) - Reviews dependency changes introduced by the pull request
   - Runs `actions/dependency-review-action` with `fail-on-severity: high`
   - Has no `needs` and no path gate — it always runs

3. **backend-lint** *(when `backend=true`)* (*Backend Linting and Validation*) - Laravel backend linting
   - Uses the `setup-backend` composite action with `tools: pint` (PHP 8.5, Composer install, `.env` from `.env.local.example`, `php artisan migrate`)
   - Runs against SQLite in memory (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`)
   - Runs `composer check-platform-reqs`
   - Runs `./vendor/bin/pint --bail`

4. **backend-tests** *(when `backend=true`)* (*Backend Tests (`<suite>`)*) - Laravel test matrix
   - Uses the `setup-backend` composite action with `tools: phpunit, pest` and `coverage: xdebug`
   - Matrix: `Unit`, `Api`, `Web`, `Filament`, `Configuration`, `Console`, `Event`, `Integration`
   - `fail-fast: true` — stops remaining suites on first failure
   - Runs each suite with `php artisan test --testsuite=<suite> --coverage --parallel --no-ansi --stop-on-failure`

5. **backend-rendered-frontend-validation** *(when `root-frontend=true`)* (*Backend Rendered Frontend Validation (Blade/Tailwind)*) - Blade/Tailwind build
   - Uses the `setup-node-project` composite action at the repository root
   - Runs `npm run build`

6. **importer-validation** *(when `importer=true`)* (*Importer Validation (TypeScript)*) - Importer TypeScript build and tests
   - Uses the `setup-node-project` composite action with `working-directory: scripts/importer`
   - Runs `npm run build` (TypeScript compilation)
   - Runs `npm test` (Vitest unit tests)

7. **site-i18n-validation** *(when `site-i18n=true`)* (*Site i18n Validation (TypeScript)*) - Shared site i18n layer validation
   - Uses the `setup-node-project` composite action with `working-directory: scripts/site-i18n`
   - Runs `npm run lint:check`, `npm run build` and `npm test`
   - Every test in this suite is a pure function over legacy row shapes, so no database, VPN or credentials are involved

8. **exporter-validation** *(when `exporters=true`)* (*Exporter Validation (`<dataset>`)*) - Dataset exporter validation
   - Matrix comes from `detect-changes`'s `exporter-datasets` output, not a hardcoded list — a forked exporter is covered from its first pull request
   - `fail-fast: false` — every dataset is reported, even when one fails
   - Uses the `setup-node-project` composite action with `working-directory: scripts/exporters/<dataset>`
   - Runs `npm run type-check`, `npm run lint:check` and `npm test` (Vitest unit tests)
   - Every test in these suites is a pure function over legacy row shapes, so no database, VPN or credentials are involved

9. **ci-success** (*CI Success*) - Aggregates all check results
   - `needs` every other job and runs with `if: always()`
   - Always requires `dependency-review` to have succeeded
   - For each path group that changed, requires the matching job(s) to have succeeded
   - When a path group did not change, its job may be skipped without failing the workflow
   - This job name satisfies the `CI Success` branch protection required check

**Permissions**

- `contents: read` - For reading repository contents

**Branch protection**

The `CI Success` job in this workflow satisfies the `CI Success` required status check configured in branch protection rules for `main`. Dependency review and the Dependabot coverage check must always pass; the path-gated lint/build/test jobs must pass whenever their path group changed.

**Usage**

This workflow runs automatically on pull requests. Skipped jobs are expected when their path group has no changed files — a skipped job is a pass, and `ci-success` only requires a job whose path group actually changed.

There is no manual trigger: CI exists to gate a pull request, and both `dependency-review` and path detection are defined only in that context. To re-run it, push to the branch or use *Re-run all jobs* on the existing run.

---

### Dependency Audit (Full Tree)

Audits the full dependency tree of every PHP and npm project in the repository on a weekly schedule, and opens (or comments on) a tracking issue when vulnerabilities are found. Dependency *changes* on a pull request are handled by the `dependency-review` job of the `CI` workflow instead.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `dependency-audit.yml` |
| **Workflow name** | `Dependency Audit (Full Tree)` |
| **Trigger** | Schedule — `0 6 * * 1` (every Monday at 06:00 UTC) |
| **Manual trigger** | Yes (`workflow_dispatch`) |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Concurrency** | Group: `dependency-audit`, cancel-in-progress: `true` |

**Jobs**

1. **audit-composer** (*Audit - Composer (PHP)*) - Audits PHP/Composer dependencies
   - Installs PHP 8.5 with extensions
   - Installs Composer dependencies
   - Runs `composer audit`

2. **enumerate-npm-projects** (*Enumerate npm Projects*) - Builds the `audit-npm` matrix from the checkout
   - Finds every `package.json` in the tree (excluding `node_modules`) and emits `projects`: a JSON array of `{name, directory}` objects. Every project resolves from the public npm registry, so no `registry` field is needed
   - No project or directory is named in this workflow — a new tool under `scripts/`, or a forked exporter or viewer, is audited from the day it lands with no edit here. `.github/dependabot.yml` covers the same directories by glob, so the two agree by construction

   | Contributes |
   | --- |
   | `Root` (`.`) |
   | `Importer` (`scripts/importer`) |
   | `Site i18n` (`scripts/site-i18n`) |
   | `Exporter (<dataset>)`, per `package.json` under `scripts/exporters/*/` |
   | `Viewer (<dataset>)`, per `package.json` under `scripts/viewers/*/` |
   | any other `package.json` under `scripts/` |

   > **Both sides read the tree.** This matrix finds every `package.json`; [`.github/dependabot.yml`](#dependabot-configuration) covers the same directories with `directories:` globs. "Gets a weekly audit" and "gets dependency updates" are therefore the same set by construction — not because a check compares two hand-written lists, but because neither list is hand-written.
   >
   > This job previously hand-listed `Root`, `SPA` and `Importer` and globbed only `scripts/exporters` and `scripts/viewers`. `scripts/site-i18n` matched none of those and received no weekly audit at all from the day it landed — which is why it now enumerates rather than enumerates-and-verifies.

3. **audit-npm** (*Audit - npm (`<name>`)*) - Audits every npm project, as a single matrix job
   - Matrix: `fromJSON` of `enumerate-npm-projects`'s `projects` output
   - `fail-fast: false` — every directory is audited even if one fails
   - Uses the `setup-node-project` composite action per matrix entry, with that entry's registry
   - Runs `npm audit --audit-level high` in each directory

4. **report** (*Report Failures*) - Reports vulnerabilities as an issue
   - `needs: [audit-composer, enumerate-npm-projects, audit-npm]`, runs with `if: always()` when any of them failed
   - Opens an issue titled `Weekly dependency audit found vulnerabilities` with the `dependencies` label, or comments on the existing open one

**Permissions**

- `contents: read` - For reading repository contents
- `issues: write` - For opening or commenting on the tracking issue

**Usage**

This workflow runs automatically every Monday. For manual triggering:

```
Actions > Dependency Audit (Full Tree) > Run workflow
```

---

## Continuous Deployment

### Build

Builds the Laravel application, packages it, publishes a GitHub pre-release, and uploads the deployment tarball consumed by `Deploy to OVH`.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `build.yml` |
| **Workflow name** | `Build` |
| **Trigger** | Push to `main` branch, or push of a `v*.*.*` tag |
| **Manual trigger** | Yes (`workflow_dispatch`) |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Environment** | `MWNF-SVR` |
| **Concurrency** | Group: `cd-${{ github.ref }}`, cancel-in-progress: `true` |

**Job: build** (*Build and Package Application*)

1. Installs PHP 8.5 (matching `.docker/Dockerfile` and the VPS) with Pint, and Node.js `lts/Krypton`
2. Installs PHP dependencies with `composer install --no-dev --optimize-autoloader`
3. Publishes Filament assets (`php artisan filament:assets`)
4. Installs and builds the backend assets with Vite (`npm ci`, `npm run build`)
5. Validates that `public/build`, `public/css/filament` and `public/js/filament` exist
6. Creates the deployment package and a `VERSION` file (app version, commit SHA, build number, timestamps)
7. Produces both `inventory-app.zip` and `release.tar.gz`
8. Generates the release tag `<package.json version>.<run_number>`
9. Creates a GitHub pre-release with `inventory-app.zip` attached
10. Uploads the artifact `release-${{ github.sha }}` (containing `release.tar.gz`) with 7-day retention

**Permissions**

- `contents: write` - For creating releases

**Usage**

This workflow runs automatically when changes are pushed to `main`. It is the upstream of `Deploy to OVH`.

---

### Deploy to OVH

Deploys the tarball produced by `Build` to the OVH VPS over SSH, by running [`scripts/deploy.sh`](../../scripts/deploy.sh) on the server.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `deploy-ovh.yml` |
| **Workflow name** | `Deploy to OVH` |
| **Trigger** | `workflow_run` — after the `Build` workflow completes on `main` |
| **Manual trigger** | Yes (`workflow_dispatch`) — optional `run_id` input; defaults to the latest successful `Build` run on `main` |
| **Runner** | `ubuntu-24.04` (GitHub-hosted) |
| **Environment** | `inventory.metanull.eu` (https://inventory.metanull.eu) |
| **Concurrency** | Group: `deploy-ovh`, cancel-in-progress: `false` |

**Job: deploy** (*Deploy to OVH VPS*)

- Only runs when triggered manually, or when the upstream `Build` run concluded `success`
- Resolves the `Build` run id and head SHA, then downloads the `release-<sha>` artifact from it
- Verifies `release.tar.gz` is present
- Sets up the SSH key, checks TCP reachability of port 22, and verifies SSH authentication (up to 3 attempts with backoff, failing fast on an auth rejection)
- Uploads `release.tar.gz` and `scripts/deploy.sh` to the VPS, then runs the deploy script
- Cleans up the uploaded files on the VPS (`if: always()`)

**Permissions**

- `contents: read` - For reading repository contents
- `actions: read` - For listing and downloading artifacts from the `Build` run

**Secrets**

| Secret | Description |
| --- | --- |
| `VPS_HOST` | Hostname or IP of the OVH VPS |
| `VPS_SSH_USER` | SSH user used for deployment |
| `VPS_SSH_KEY` | Private SSH key for that user |

---

### Deploy Documentation to GitHub Pages

Generates and deploys the Jekyll-based static documentation website to GitHub Pages. This workflow calls a Python script to generate commit history documentation.

See [/docs/README.md](../../docs/README.md) for complete Jekyll site documentation.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `continuous-deployment_github-pages.yml` |
| **Workflow name** | `Documentation` |
| **Trigger** | Push to `main` branch |
| **Manual trigger** | Yes (`workflow_dispatch`) |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Concurrency** | Group: `pages-deploy`, cancel-in-progress: `true` |

**Jobs**

1. **build** - Generates and builds documentation
   - Checks out repository with full Git history (`fetch-depth: 0`)
   - Sets up Python 3.x
   - Sets up Ruby (working directory `docs`). The version lives in the workflow itself; keep it in step with `.docker/Dockerfile.docs` and `docs/Gemfile`
   - Installs Ruby dependencies with `bundle install`
   - **Generates commit history documentation** - Calls `python scripts/generate-commit-docs.py`. See [/scripts/README.md](../../scripts/README.md#generating-the-git-commit-history)
   - Builds Jekyll site with `bundle exec jekyll build`
   - Uploads `docs/_site` as the GitHub Pages artifact

2. **deploy** *(needs `build`)* - Deploys to GitHub Pages
   - Uses `actions/deploy-pages` to publish the site
   - Sets environment to `github-pages`
   - Outputs deployment URL

**Permissions**

- `contents: read` - For reading repository contents (workflow default)
- `contents: write` - Overridden on the `build` job, for committing generated documentation
- `pages: write` - For deploying to GitHub Pages
- `id-token: write` - For GitHub Pages authentication

**Scripts called**

This workflow depends on the following script:
- `generate-commit-docs.py` - Converts Git commit history into Jekyll markdown pages. See [/scripts/README.md](../../scripts/README.md#generating-the-git-commit-history)

For Jekyll site documentation, see [/docs/README.md](../../docs/README.md)

**Usage**

This workflow runs automatically on push to `main`. For manual deployment:

```bash
# Trigger via GitHub UI: Actions > Documentation > Run workflow
```

**Links**

| Reference | URL |
| --- | --- |
| GitHub Pages | [https://pages.github.com/](https://pages.github.com/) |
| Documentation Site | [https://museumwithnofrontiers.github.io/inventory-app](https://museumwithnofrontiers.github.io/inventory-app) |
| Jekyll Documentation | [https://jekyllrb.com/docs/](https://jekyllrb.com/docs/) |

---

### Deploy Dataset Viewers to OVH

One workflow per dataset viewer. Each builds its Vite viewer against the **latest published** `@museumwnf/<dataset>-data` package and copies the build output to the OVH VPS over SSH.

**Workflows**

| Dataset | Workflow | Path filter | Vite base | Target directory | URL |
| --- | --- | --- | --- | --- | --- |
| `baroqueart` | `deploy-viewer-baroqueart-ovh.yml` | `scripts/viewers/baroqueart/**` | `/baroqueart/` | `/opt/baroqueart/` | https://inventory.metanull.eu/baroqueart/ |
| `islamicart` | `deploy-viewer-islamicart-ovh.yml` | `scripts/viewers/islamicart/**` | `/islamicart/` | `/opt/islamicart/` | https://inventory.metanull.eu/islamicart/ |
| `sharinghistory` | `deploy-viewer-sharinghistory-ovh.yml` | `scripts/viewers/sharinghistory/**` | `/sharinghistory/` | `/opt/sharinghistory/` | https://inventory.metanull.eu/sharinghistory/ |
| `amulets` | `deploy-viewer-amulets-ovh.yml` | `scripts/viewers/amulets/**` | `/amulets/` | `/opt/amulets/` | https://inventory.metanull.eu/amulets/ |
| `carpets` | `deploy-viewer-carpets-ovh.yml` | `scripts/viewers/carpets/**` | `/carpets/` | `/opt/carpets/` | https://inventory.metanull.eu/carpets/ |

**Workflow properties** (identical apart from the dataset name)

| Property | Value |
| --- | --- |
| **Trigger** | Push to `main` limited to the viewer's own path filter |
| **Manual trigger** | Yes (`workflow_dispatch`) |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Environment** | `inventory.metanull.eu` |
| **Concurrency** | Group: `deploy-viewer-<dataset>-ovh`, cancel-in-progress: `false` |

**Job: build-and-deploy** (*Build and Deploy `<dataset>` Viewer*)

1. Sets up Node.js `lts/Krypton` (no registry scoping needed — the data package is public on npmjs)
2. Installs viewer dependencies with `npm ci`
3. Runs `npm install @museumwnf/<dataset>-data@latest` — the newest data package is always pulled, regardless of what `package-lock.json` pins, so the viewer reflects current data
4. Builds with `npm run build -- --base=/<dataset>/`
5. Sets up SSH, checks VPS connectivity and verifies SSH authentication
6. Copies `dist/` to the target directory on the VPS with `scp`
7. Removes the SSH key (`if: always()`)

**Permissions**

- `contents: read` - For reading repository contents. `@museumwnf/<dataset>-data` is public on npmjs, so no `packages: read` permission is needed here.

**Secrets**

| Secret | Description |
| --- | --- |
| `VPS_HOST` | Hostname or IP of the OVH VPS |
| `VPS_SSH_USER` | SSH user used for deployment |
| `VPS_SSH_KEY` | Private SSH key for that user |

---

## Automation Workflows

### Dependabot Configuration

Dependabot is configured in `.github/dependabot.yml` to keep dependencies up to date across the repository.

> **Node projects under `scripts/` are covered by glob.** Adding a forked exporter, a new viewer or a new tool needs **no change** to `.github/dependabot.yml` — it lands inside one of the `directories:` patterns and is picked up on the next run.

**Ecosystems monitored**

| Ecosystem | Directories | Schedule | Registry |
| --- | --- | --- | --- |
| `composer` | `/` | Weekly | packagist.org (public) |
| `npm` | `/` | Weekly | registry.npmjs.org (public) |
| `npm` | `/scripts/*` | Weekly | registry.npmjs.org (public) |
| `npm` | `/scripts/exporters/*` | Weekly | registry.npmjs.org (public) |
| `npm` | `/scripts/viewers/*` | Weekly | registry.npmjs.org (public) |
| `github-actions` | `/` | Weekly | github.com (public) |

`/scripts/*` is one level deep on purpose: `scripts/exporters` and `scripts/viewers` hold no manifest of their own, and their children are matched by the two patterns below it.

**No entry carries a `registries:` key.** Every npm project resolves from the public registry — the viewers install `@museumwnf/<dataset>-data` from npmjs like everything else — so no entry needs a credential, and a new project inherits the right answer from where its directory lives rather than from a reviewer noticing.

**One pull request per directory.** A glob does not couple the projects it matches: Dependabot's default for a multi-directory entry is a separate PR per directory, so a failing bump in one exporter does not block the others. Setting `group-by: dependency-name` on a group would collapse them into a single cross-directory PR — avoid that unless PR volume ever becomes the problem.

> **History.** This file used to carry one hand-written entry per project (20 in all), policed by a blocking `Dependabot Coverage` job running `scripts/check-dependabot-coverage.sh`. That machinery existed because Dependabot config was believed unable to enumerate directories — true when it was written, but the `directories:` key with glob support shipped in [June 2024](https://github.blog/changelog/2024-06-25-simplified-dependabot-yml-configuration-with-multi-directory-key-directories-and-wildcard-glob-support/). The hand-maintenance had already failed twice in practice (`scripts/viewers/amulets` in PR #1566, patched in #1572), and the check never caught the one real outage — every viewer's job aborted for months over a missing registry `scope` (#1609) while the coverage check passed, because it validated the config's shape rather than whether the job ran. Both the script and the gate were removed once the globs replaced them.

**Links**

| Reference | URL |
| --- | --- |
| Dependabot configuration options | [https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file) |

---

### Merge Dependabot PR

Automatically approves and enables auto-merge for eligible Dependabot pull requests.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `merge-dependabot-pr.yml` |
| **Workflow name** | `Dependabot Auto-Merge` |
| **Trigger** | `pull_request_target` (any PR activity) |
| **Manual trigger** | No |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Condition** | Only runs if PR author is `dependabot[bot]` |

**Job: dependabot**

1. Fetches Dependabot PR metadata using the `dependabot/fetch-metadata` action
2. Determines auto-merge eligibility from the package ecosystem and update type
3. Approves eligible PRs using `gh pr review --approve`
4. Enables auto-merge on eligible PRs using `gh pr merge --auto --squash`

**Permissions**

- `pull-requests: write` - For approving and merging PRs
- `contents: write` - For merging changes

**Behavior**

- **`github_actions` ecosystem**: Auto-merged at any semver level, including major — Actions bumps only touch the CI pipeline, never shipped application code, and a broken one fails the same PR's required checks immediately
- **Application dependencies (npm/composer), minor and patch updates**: Automatically approved and enabled for auto-merge
- **Application dependencies (npm/composer), major updates**: Require manual review (not auto-approved)

**Usage**

This workflow runs automatically when Dependabot opens a pull request. No manual intervention is needed for eligible updates.

**Links**

| Reference | URL |
| --- | --- |
| Dependabot | [https://docs.github.com/en/code-security/dependabot](https://docs.github.com/en/code-security/dependabot) |
| dependabot/fetch-metadata | [https://github.com/dependabot/fetch-metadata](https://github.com/dependabot/fetch-metadata) |

---

## Composite Actions

Repeated setup and publishing steps live in [`.github/actions`](../actions) and are referenced from workflows with `uses: ./.github/actions/<name>`.

| Action | Purpose | Key inputs / outputs | Used by |
| --- | --- | --- | --- |
| `setup-backend` | Installs PHP (default 8.5) with the project's extensions, installs Composer dependencies, creates `.env` from `.env.local.example`, generates the app key and migrates the database | Inputs: `php-version`, `tools`, `coverage` | `continuous-integration.yml` |
| `setup-node-project` | Installs Node.js `lts/Krypton`, enables Corepack and runs `npm ci` in a given directory | Inputs: `working-directory`, `registry-url`, `node-auth-token` | `continuous-integration.yml`, `dependency-audit.yml` |

---

## Workflow Dependencies

Several workflows interact with scripts, composite actions and other workflows:

| Workflow | Depends On | Triggers |
| --- | --- | --- |
| `continuous-integration.yml` | `setup-backend`, `setup-node-project` | - |
| `dependency-audit.yml` | `setup-node-project` | - |
| `build.yml` | - | `deploy-ovh.yml` (via `workflow_run`) |
| `deploy-ovh.yml` | `build.yml` artifact, `scripts/deploy.sh` | - |
| `continuous-deployment_github-pages.yml` | [/scripts/README.md](../../scripts/README.md) scripts | - |
| `deploy-viewer-*-ovh.yml` | `@museumwnf/<dataset>-data` on npmjs (public) | - |
| `merge-dependabot-pr.yml` | - | - |

**Scripts used by workflows:**

- `generate-commit-docs.py` - Used by `continuous-deployment_github-pages.yml`. See [/scripts/README.md](../../scripts/README.md#generating-the-git-commit-history)
- `deploy.sh` - Uploaded to the VPS and executed by `deploy-ovh.yml`. See [/scripts/README.md](../../scripts/README.md#deployment-scripts)

---

## Contributing

When adding new workflows:

1. Add description to this README
2. Document triggers, jobs, permissions, and environment variables
3. Update the workflow dependencies table
4. Add cross-references to [/scripts/README.md](../../scripts/README.md) if applicable
5. Test both manual and automated execution
6. Validate workflow syntax with `node scripts/validate-workflows.cjs`. See [/scripts/README.md](../../scripts/README.md#validation-of-the-workflow-files)
