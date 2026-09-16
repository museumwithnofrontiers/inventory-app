---
layout: default
title: GitHub Workflows
parent: Development
nav_order: 5
permalink: /development/workflows/
---

The `/.github/workflows` directory contains GitHub Actions workflows for continuous integration, deployment, and automation tasks.

## Table of contents

- [Workflows](#workflows)
  - [Table of contents](#table-of-contents)
  - [Notes](#notes)
  - [Continuous Integration and Testing](#continuous-integration-and-testing)
    - [Mandatory Checks](#mandatory-checks)
    - [Build and Test](#build-and-test)
  - [Continuous Deployment](#continuous-deployment)
    - [Deploy Laravel Application](#deploy-laravel-application)
    - [Deploy Documentation to GitHub Pages](#deploy-documentation-to-github-pages)
  - [Automation Workflows](#automation-workflows)
    - [Version Bump](#version-bump)
    - [Merge Dependabot PR](#merge-dependabot-pr)
  - [Workflow Dependencies](#workflow-dependencies)
  - [Contributing](#contributing)

## Notes

- **Workflows run on GitHub-hosted runners** (`ubuntu-latest`) or **self-hosted runners** (`[self-hosted, windows]`) depending on the task
- **Python workflows** use Python 3.x on Ubuntu runners for documentation generation
- **PowerShell workflows** use PowerShell on Windows runners for application deployment
- Most workflows use **concurrency groups** to prevent duplicate runs and conserve resources
- Workflows are triggered by push events, pull requests, releases, or manual dispatch (`workflow_dispatch`)
- Several workflows interact with scripts in [/scripts/README.md](/development/scripts)

## Continuous Integration and Testing

### Mandatory Checks

Runs mandatory dependency audits on every pull request. Provides the `CI Success` status check required by branch protection rules.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `continuous-integration.yml` |
| **Trigger** | Pull requests to `main` branch (opened, synchronize, reopened) |
| **Manual trigger** | Yes (`workflow_dispatch`) |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Concurrency** | Group: `ci-mandatory-${{ github.ref }}`, cancel-in-progress: `true` |

**Jobs**

1. **audit-composer** - Audits PHP/Composer dependencies
   - Installs PHP 8.5 with extensions
   - Validates `composer.json` with strict checks
   - Installs Composer dependencies
   - Runs `composer audit --format=summary`

2. **audit-npm-root** - Audits root npm dependencies
   - Installs Node.js lts/Krypton (24.x)
   - Installs root npm dependencies
   - Runs `npm audit --audit-level moderate`

3. **audit-npm-importer** - Audits `scripts/importer` npm dependencies
   - Installs Node.js lts/Krypton (24.x)
   - Installs importer npm dependencies from `scripts/importer/`
   - Runs `npm audit --audit-level moderate`

4. **ci-success** - Aggregates audit results
   - Requires all 3 audit jobs to succeed
   - Fails the workflow if any audit job failed or was skipped
   - This job name satisfies the `CI Success` branch protection required check

**Permissions**

- `contents: read` - For reading repository contents

**Branch protection**

The `CI Success` job in this workflow satisfies the `CI Success` required status check configured in branch protection rules for `main`. All 3 audits must pass before a PR can be merged.

**Usage**

This workflow runs automatically on pull requests. For manual triggering:

```
Actions > Mandatory Checks > Run workflow
```

---

### Build and Test

Runs build and test jobs conditionally based on which paths changed in the pull request. Jobs are skipped when no relevant files were modified. This workflow does not provide a required status check.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `ci-build-test.yml` |
| **Trigger** | Pull requests to `main` branch (opened, synchronize, reopened) |
| **Manual trigger** | Yes (`workflow_dispatch`) — all jobs run when triggered manually |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Concurrency** | Group: `ci-build-test-${{ github.ref }}`, cancel-in-progress: `true` |

**Path groups and triggered jobs**

| Changed paths | Jobs triggered |
| --- | --- |
| `app/**`, `routes/**`, `config/**`, `database/**`, `tests/**`, `bootstrap/**`, `composer.json`, `composer.lock`, `phpunit.xml`, `artisan` | `backend-lint`, `backend-tests` |
| `resources/css/**`, `resources/js/**`, `resources/views/**`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js` | `backend-rendered-frontend-validation` |

**Jobs**

1. **detect-changes** - Classifies changed files using `git diff` against the PR base SHA
   - Emits outputs: `backend`, `root-frontend` (true/false)
   - All outputs are `true` when triggered by `workflow_dispatch`

2. **backend-lint** *(when `backend=true`)* - Laravel backend linting
   - Installs PHP 8.5 with extensions and Pint
   - Installs Composer dependencies
   - Creates `.env` from `.env.local.example`, migrates database
   - Runs `./vendor/bin/pint --bail`

3. **backend-tests** *(when `backend=true`)* - Laravel test matrix
   - Matrix: `Unit`, `Api`, `Web`, `Configuration`, `Console`, `Event`, `Integration`
   - `fail-fast: true` — stops remaining suites on first failure
   - Runs each suite with `--coverage --parallel --stop-on-failure`

4. **backend-rendered-frontend-validation** *(when `root-frontend=true`)* - Blade/Tailwind build
   - Installs Node.js lts/Krypton and root npm dependencies
   - Runs `npm run build`

**Permissions**

- `contents: read` - For reading repository contents

**Usage**

This workflow runs automatically on pull requests. Skipped jobs are expected when their path group has no changed files. For manual triggering (all jobs run):

```
Actions > Build and Test > Run workflow
```

---

## Continuous Deployment

### Deploy Laravel Application

Builds the Laravel application and deploys it to a production environment using a symlink-based deployment strategy.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `continuous-deployment.yml` |
| **Trigger** | Push to `main` branch |
| **Manual trigger** | No |
| **Runner** | `[self-hosted, windows]` |
| **Environment** | `MWNF-SVR` |

**Jobs**

1. **build** - Builds deployment package
   - Validates environment variables and paths (PHP, Composer, Node.js, npm, MariaDB)
   - Installs PHP dependencies with `composer install --no-dev --optimize-autoloader`
   - Configures npm authentication for GitHub Packages
   - Installs Node.js dependencies with `npm install`
   - Builds frontend assets with Vite (`npm run build`)
   - Creates deployment package excluding dev dependencies
   - Generates `VERSION` file with app version, commit SHA, and timestamps
   - Uploads deployment artifact (`laravel-app-${{ github.sha }}`) with 7-day retention

2. **deploy** - Deploys to staging directory with symlink swap
   - Downloads deployment artifact
   - Creates timestamped staging directory (`staging-YYYYMMDD-HHMMSS`)
   - Puts old application into maintenance mode (`php artisan down`)
   - Creates temporary symlink to new staging directory
   - Atomically swaps symlinks to minimize downtime
   - Cleans up obsolete staging directories (keeps last 3)
   - Implements rollback capability if symlink swap fails

3. **configure** - Configures Laravel application
   - Generates production `.env` file from `.env.example` using environment variables
   - Runs database migrations (`php artisan migrate --force`)
   - Syncs permissions and roles (`php artisan permissions:sync --production`)
   - Caches configuration, routes, and views for performance

**Environment Variables** (set in GitHub environment `MWNF-SVR`)

| Variable | Description | Default |
| --- | --- | --- |
| `PHP_PATH` | Path to PHP executable | `C:\Program Files\PHP\php.exe` |
| `COMPOSER_PATH` | Path to Composer executable | `C:\ProgramData\ComposerSetup\bin\composer.bat` |
| `NODE_PATH` | Path to Node.js executable | `C:\Program Files\nodejs\node.exe` |
| `NPM_PATH` | Path to npm executable | `C:\Program Files\nodejs\npm.ps1` |
| `MARIADB_PATH` | Path to MariaDB client | `C:\Program Files\MariaDB 10.5\bin\mysql.exe` |
| `DEPLOY_PATH` | Deployment base directory | `C:\Apache24\htdocs\inventory-app` |
| `WEBSERVER_PATH` | Symlink location for webserver | `C:\Apache24\htdocs\inventory-app` |
| `APP_NAME` | Application name | `inventory-app` |
| `APP_ENV` | Environment (production/staging) | `production` |
| `APP_DEBUG` | Enable debug mode | `false` |
| `APP_URL` | Application URL | `http://localhost` |
| `DB_CONNECTION` | Database driver | `mysql` |
| `DB_HOST` | Database host | `127.0.0.1` |
| `DB_PORT` | Database port | `3306` |
| `API_DOCS_ENABLED` | Enable API documentation | `false` |
| `APACHE_SERVICE_USER` | Apache service user | `SYSTEM` |
| `TRUSTED_PROXIES` | Comma-separated proxy IPs/CIDR | (empty) |

**Environment Secrets** (set in GitHub environment `MWNF-SVR`)

| Secret | Description |
| --- | --- |
| `APP_KEY` | Laravel application key (generate with `php artisan key:generate --show`) |
| `MARIADB_DATABASE` | Database name |
| `MARIADB_USER` | Database username |
| `MARIADB_SECRET` | Database password |

**Deployment Strategy**

This workflow uses a **symlink-based zero-downtime deployment**:
1. Build artifact is downloaded to a timestamped staging directory
2. Application is put into maintenance mode
3. A temporary symlink is created pointing to the new staging directory
4. The webserver symlink is atomically swapped to the new deployment
5. Old symlinks are removed
6. Old staging directories are cleaned up (keeps last 3 for rollback)

**Permissions**

- `contents: read` - For reading repository contents
- `packages: read` - For accessing GitHub Packages

**Usage**

This workflow runs automatically when changes are pushed to `main`.

**Links**

| Reference | URL |
| --- | --- |
| Laravel Deployment | [https://laravel.com/docs/12.x/deployment](https://laravel.com/docs/12.x/deployment) |
| GitHub Environments | [https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) |

---

### Deploy Documentation to GitHub Pages

Generates and deploys the Jekyll-based static documentation website to GitHub Pages. This workflow calls a Python script to generate commit history documentation.

See [/docs/README.md](/development/documentation-site) for complete Jekyll site documentation.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `continuous-deployment_github-pages.yml` |
| **Trigger** | Push to `main` branch |
| **Manual trigger** | Yes (`workflow_dispatch`) |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Concurrency** | Group: `pages-deploy`, cancel-in-progress: `true` |

**Jobs**

1. **build** - Generates and builds documentation
   - Checks out repository with full Git history (`fetch-depth: 0`)
   - Sets up Python 3.x
   - Sets up Ruby 3.2.3
   - Installs Ruby dependencies with `bundle install`
   - **Generates commit history documentation** - Calls `python scripts/generate-commit-docs.py`. See [/scripts/README.md](/development/scripts#generating-the-git-commit-history)
   - Builds Jekyll site with `bundle exec jekyll build`
   - Uploads artifact for GitHub Pages

2. **deploy** - Deploys to GitHub Pages
   - Uses `actions/deploy-pages@v4` to publish the site
   - Sets environment to `github-pages`
   - Outputs deployment URL

**Permissions**

- `contents: read` - For reading repository contents
- `contents: write` - For committing generated documentation (build job)
- `pages: write` - For deploying to GitHub Pages
- `id-token: write` - For GitHub Pages authentication

**Scripts called**

This workflow depends on the following scripts:
- `generate-commit-docs.py` - Converts Git commit history into Jekyll markdown pages. See [/scripts/README.md](/development/scripts#generating-the-git-commit-history)

For Jekyll site documentation, see [/docs/README.md](/development/documentation-site)

**Usage**

This workflow runs automatically on push to `main`. For manual deployment:

```bash
# Trigger via GitHub UI: Actions > Continuous Deployment to GitHub Pages > Run workflow
```

**Links**

| Reference | URL |
| --- | --- |
| GitHub Pages | [https://pages.github.com/](https://pages.github.com/) |
| Documentation Site | [https://metanull.github.io/inventory-app](https://metanull.github.io/inventory-app) |
| Jekyll Documentation | [https://jekyllrb.com/docs/](https://jekyllrb.com/docs/) |

---

## Automation Workflows

### Version Bump

Automatically bumps the project version based on merged pull request labels after successful CI runs.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `version-bump.yml` |
| **Trigger** | After `Continuous Integration` workflow completes successfully on `main` |
| **Manual trigger** | Yes (`workflow_dispatch`) |
| **Runner** | `windows-latest` (GitHub-hosted) |
| **Concurrency** | Group: `version-bump-${{ github.ref }}`, cancel-in-progress: `true` |

**Job: version-bump**

1. Checks out repository with full Git history
2. Sets up Node.js 20.x
3. Checks if commit is already a version bump (skips if so)
4. Retrieves merged PR information and labels
5. Determines version bump type based on labels:
   - `breaking-change` → **major** version bump
   - `feature` → **minor** version bump
   - `bugfix` → **patch** version bump
   - Default: **patch** version bump
6. Bumps version in `package.json` using `npm version`
7. Commits and pushes version bump to `main` branch

**Permissions**

- `contents: write` - For committing version bumps
- `pull-requests: read` - For reading PR metadata

**Usage**

This workflow runs automatically after CI completes successfully. For manual version bumping:

```bash
# Trigger via GitHub UI: Actions > Version Bump > Run workflow
```

**PR Labeling Guide**

To control version bumping, apply these labels to your pull requests:
- `breaking-change` - For breaking API changes (major version)
- `feature` - For new features (minor version)
- `bugfix` - For bug fixes (patch version)

**Links**

| Reference | URL |
| --- | --- |
| Semantic Versioning | [https://semver.org/](https://semver.org/) |
| GitHub Actions workflow_run | [https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run) |

---

### Dependabot Configuration

Dependabot is configured in `.github/dependabot.yml` to keep dependencies up to date for four ecosystems.

**Ecosystems monitored**

| Ecosystem | Directory | Schedule | Registry |
| --- | --- | --- | --- |
| `composer` | `/` | Weekly | packagist.org (public) |
| `npm` | `/` | Weekly | npmjs.org (public) |
| `github-actions` | `/` | Weekly | github.com (public) |

**Setup instructions**

1. Create a Personal Access Token (classic) with `read:packages` scope
2. Store it as a **Dependabot secret** (not a regular Actions secret) named `DEPENDABOT_GITHUB_PACKAGES_TOKEN` under **Settings > Secrets and variables > Dependabot**

> Note: Dependabot secrets (under the Dependabot tab) are separate from Actions secrets (under the Actions tab). A secret in the Actions tab is **not** accessible to Dependabot.

**Links**

| Reference | URL |
| --- | --- |
| Dependabot configuration options | [https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file) |
| Dependabot on Actions runners | [https://docs.github.com/en/code-security/dependabot/working-with-dependabot/about-dependabot-on-github-actions-runners](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/about-dependabot-on-github-actions-runners) |
| Configuring access to private registries | [https://docs.github.com/en/code-security/dependabot/working-with-dependabot/configuring-access-to-private-registries-for-dependabot](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/configuring-access-to-private-registries-for-dependabot) |

---

### Merge Dependabot PR

Automatically approves and enables auto-merge for Dependabot pull requests that are not major version updates.

**Workflow properties**

| Property | Value |
| --- | --- |
| **Workflow** | `merge-dependabot-pr.yml` |
| **Trigger** | `pull_request_target` (any PR opened) |
| **Manual trigger** | No |
| **Runner** | `ubuntu-latest` (GitHub-hosted) |
| **Condition** | Only runs if PR author is `dependabot[bot]` |

**Job: dependabot**

1. Fetches Dependabot PR metadata using `dependabot/fetch-metadata` action
2. Checks if update type is not a major version update
3. Approves the PR using `gh pr review --approve`
4. Enables auto-merge on the PR

**Permissions**

- `pull-requests: write` - For approving and merging PRs
- `contents: write` - For merging changes

**Behavior**

- **Minor and patch updates**: Automatically approved and enabled for auto-merge
- **Major updates**: Require manual review (not auto-approved)

**Usage**

This workflow runs automatically when Dependabot opens a pull request. No manual intervention needed for minor/patch updates.

**Links**

| Reference | URL |
| --- | --- |
| Dependabot | [https://docs.github.com/en/code-security/dependabot](https://docs.github.com/en/code-security/dependabot) |
| dependabot/fetch-metadata | [https://github.com/dependabot/fetch-metadata](https://github.com/dependabot/fetch-metadata) |

---

## Workflow Dependencies

Several workflows interact with scripts and other workflows:

| Workflow | Depends On | Triggers |
| --- | --- | --- |
| `continuous-integration.yml` | - | - |
| `ci-build-test.yml` | - | - |
| `build.yml` | - | `deploy-ovh.yml` |
| `continuous-deployment_github-pages.yml` | [/scripts/README.md](/development/scripts) scripts | - |
| `merge-dependabot-pr.yml` | - | - |

**Scripts used by workflows:**

- `generate-commit-docs.py` - Used by `continuous-deployment_github-pages.yml`. See [/scripts/README.md](/development/scripts#generating-the-git-commit-history)

---

## Contributing

When adding new workflows:

1. Add description to this README
2. Document triggers, jobs, permissions, and environment variables
3. Update the workflow dependencies table
4. Add cross-references to [/scripts/README.md](/development/scripts) if applicable
5. Test both manual and automated execution
6. Validate workflow syntax with `node scripts/validate-workflows.cjs`. See [/scripts/README.md](/development/scripts#validation-of-the-workflow-files)
