# Scripts

The /scripts directory contains automation and helper scripts used for documentation, deployment, and development, etc.

## Table of contents

- [Scripts](#scripts)
  - [Table of contents](#table-of-contents)
  - [Notes](#notes)
  - [Deployment Scripts](#deployment-scripts)
    - [Overview](#overview)
    - [Scripts](#scripts-1)
    - [Quick Start](#quick-start)
    - [Deployment Phases](#deployment-phases)
    - [Directory Structure](#directory-structure)
    - [Rollback](#rollback)
    - [References](#references)
  - [Scripts used in CI/CD Workflows](#scripts-used-in-cicd-workflows)
    - [Auto-generation of the static documentation website](#auto-generation-of-the-static-documentation-website)
      - [Generating the Git Commit History](#generating-the-git-commit-history)
  - [Scripts used locally during development](#scripts-used-locally-during-development)
    - [Generation of the static documentation website](#generation-of-the-static-documentation-website)
      - [Generating the static documentation website locally](#generating-the-static-documentation-website-locally)
      - [Running the static documentation website locally](#running-the-static-documentation-website-locally)
      - [Auto-generating the Model documentation](#auto-generating-the-model-documentation)
    - [Local CI/CD Build Simulation](#local-cicd-build-simulation)
    - [Development helpers](#development-helpers)
      - [Image seeding](#image-seeding)
      - [Migration testing](#migration-testing)
      - [Validation of the Workflow files](#validation-of-the-workflow-files)
      - [Running tests in parallel](#running-tests-in-parallel)

## Notes

- **Python scripts** require Python 3.x - it is meant to be used in pipeline workflows
- **PowerShell scripts** require PowerShell 5.1 or PowerShell Core 7+ - it is meant to be used on the developer's machine
- **Node.js scripts** require Node.js 16+
- All scripts should be run from the **project root directory**
- GitHub Actions automatically set up required dependencies

## Deployment Scripts

PowerShell-based deployment automation for Windows servers with persistent storage, atomic symlink swapping, and automatic rollback.

### Overview

The deployment system provides a production-ready deployment solution for Windows servers:

- **Persistent Storage** - Symlinks preserve logs, cache, sessions across deployments
- **Atomic Swaps** - Safe production switchover with automatic rollback
- **Comprehensive Validation** - Pre-deployment checks for system prerequisites
- **Easy Rollback** - Previous deployments available for quick restoration

**Required**: Windows Server 2016+, PowerShell 5.0+, Administrator privileges, PHP 8.2+, MySQL/MariaDB

### Scripts

| Script | Purpose |
| --- | --- |
| `Deploy-Application.ps1` | Main deployment entry point |
| `InventoryApp.Deployment/InventoryApp.Deployment.psm1` | Core deployment module with all functions |
| `InventoryApp.Deployment/InventoryApp.Deployment.psd1` | Module manifest |

### Quick Start

```powershell
# Prepare database password
$dbPassword = ConvertTo-SecureString "password" -AsPlainText -Force

# Run deployment
.\scripts\Deploy-Application.ps1 `
    -DeploymentPackagePath "C:\temp\inventory-app-release" `
    -WebserverPath "C:\Apache24\htdocs\inventory-app" `
    -SharedStorageRoot "C:\mwnf-server\github-apps" `
    -PhpPath "C:\php\php.exe" `
    -AppUrl "https://inventory.museumwnf.org" `
    -AppName "Inventory App" `
    -AppEnv "production" `
    -AppKey "base64:xxxxx..." `
    -DatabaseHost "127.0.0.1" `
    -DatabasePort 3306 `
    -DatabaseName "inventory_db" `
    -DatabaseUsername "app" `
    -DatabasePassword $dbPassword `
    -Verbose
```

### Deployment Phases

1. **Validation** - System and package integrity
2. **Staging Preparation** - Create timestamped directory
3. **Persistent Storage** - Setup symlinks
4. **Application Down** - Maintenance mode
5. **Production Swap** - Atomic symlink switch
6. **Configuration** - Generate `.env`
7. **Laravel Setup** - Migrations and caching
8. **Cleanup** - Remove old deployments

### Directory Structure

```
C:\mwnf-server\github-apps\
├─ production/                  (symlink → staging-YYYYMMDD-HHMMSS)
├─ staging-20251031-041516/     (current active)
│  └─ storage/                  (symlink → ../shared-storage/storage)
├─ staging-20251030-123456/     (previous - for rollback)
└─ shared-storage/storage/      (persistent data)
   ├─ logs/                     (preserved across deployments)
   ├─ framework/cache/
   ├─ framework/sessions/
   └─ framework/views/
```

### Rollback

**Automatic**: If deployment fails after production swap, previous version is automatically restored.

**Manual**: 
```powershell
# List available versions
Get-ChildItem -Path "C:\mwnf-server\github-apps" -Directory -Filter "staging-*" |
    Sort-Object -Property Name -Descending

# Restore specific version
Remove-Item "C:\Apache24\htdocs\inventory-app" -Force
New-Item -ItemType Junction `
    -Path "C:\Apache24\htdocs\inventory-app" `
    -Target "C:\mwnf-server\github-apps\staging-PREVIOUS-VERSION"
```

### References

| Reference | Url |
| --- | --- |
| Deployment Guide | [https://museumwithnofrontiers.github.io/inventory-app/deployment/](https://museumwithnofrontiers.github.io/inventory-app/deployment/) |
| Release Artifacts | [https://github.com/museumwithnofrontiers/inventory-app/releases](https://github.com/museumwithnofrontiers/inventory-app/releases) |
| GitHub Actions Workflow | [/.github/workflows/release-deployment.yml](../.github/workflows/release-deployment.yml) |

## Scripts used in CI/CD Workflows

### Auto-generation of the static documentation website

These scripts are triggered by the CI/CD Workflow action `.github/workflows/continuous-deployment_github-pages.yml` responsible for deploying the static documentation website to [github.io](https://museumwithnofrontiers.github.io). 

See:
- [/.github/workflows/README.md](../.github/workflows/README.md#deploy-documentation-to-github-pages) for workflow details
- [/docs/README.md](../docs/README.md) for Jekyll site documentation

#### Generating the Git Commit History

Converts Git commit history into Jekyll-compatible markdown pages.

These files are integrated by Jekyll into the static documentation website under `/inventory-app/development/archive`.

The script is called by CI workflows on push to main. 

See:
- [/.github/workflows/README.md](../.github/workflows/README.md#deploy-documentation-to-github-pages) for workflow details
- [/docs/README.md](../docs/README.md#script-generate-commit-documentation) for Jekyll integration

**Script properties**

| Property | Value |
| --- | --- |
| **Script** | `generate-commit-docs.py` |
| **Invoker** | Invoked by `.github/workflows/continuous-deployment_github-pages.yml` on **push** to **main**. See [/.github/workflows/README.md](../.github/workflows/README.md#deploy-documentation-to-github-pages) |
| **Input** | It reads from git directly |
| **Output** | `/docs/_docs/**/*.md` |
| **Log** | `/docs/commit-docs.log` |

**Links**

| Reference | Url |
| --- | --- |
| Git Commit History | [https://museumwithnofrontiers.github.io/inventory-app/development/archive](https://museumwithnofrontiers.github.io/inventory-app/development/archive) |

**Usage:**
```bash
# Run from project root
python scripts/generate-commit-docs.py
```

## Scripts used locally during development

### Generation of the static documentation website

#### Generating the static documentation website locally

Invokes the Jekyll Ruby Gem in a Windows Subsystem for Linux (WSL) terminal; it transforms the content of /docs into a static website.

See [/docs/README.md](../docs/README.md#building-the-site) for Jekyll site documentation.

**Script properties**

| Property | Value |
| --- | --- |
| **Script** | `jekyll-build.ps1` |
| **Invoker** | Invoked by the developer after **change** to `/docs/**/*.md` |
| **Input** | `/docs` |
| **Output** | `/docs/_site/**` |
| Log | **N/A** - The script writes to the terminal |

**Usage**

```powershell
# Build with defaults
. ./scripts/jekyll-build.ps1

# Build with custom base URL
. ./scripts/jekyll-build.ps1 -BaseUrl "/my-app"

# Clean build
. ./scripts/jekyll-build.ps1 -Clean
```

**Requirements**
- WSL (Windows Subsystem for Linux) installed
- Ruby installed in WSL (user-installed required)
- Jekyll and bundler gems installed

#### Running the static documentation website locally

Serves the static documentation website on a local URL [http://localhost:4000](http://localhost:4000).

See [/docs/README.md](../docs/README.md#building-the-site) for Jekyll site documentation.

**Script properties**

| Property | Value |
| --- | --- |
| **Script** | `jekyll-serve.ps1` |
| **Invoker** | Invoked by the developer after **change** to `/docs/**/*.md` |
| **Input** | `/docs` |
| **Output 1** | `/docs/_site/**` |
| **Output 2** | [http://localhost:4000](http://localhost:4000) |
| Log | **N/A** - The script writes to the terminal |

**Links**

| Reference | Url |
| --- | --- |
| Local static documentation website | [http://localhost:4000](http://localhost:4000) |

**Usage**

```powershell
# Serve with defaults (http://127.0.0.1:4000)
. ./scripts/jekyll-serve.ps1

# Custom port
. ./scripts/jekyll-serve.ps1 -Port 8080

# Enable LiveReload
. ./scripts/jekyll-serve.ps1 -LiveReload

# Serve on all network interfaces
. ./scripts/jekyll-serve.ps1 -Host 0.0.0.0
```

**Requirements**
- WSL (Windows Subsystem for Linux) installed
- Ruby installed in WSL (user-installed required)
- Jekyll and bundler gems installed

#### Auto-generating the Model documentation

Auto-generates markdown documentation for Laravel models (schemas, relations, fields).

**Script properties**

| Property | Value |
| --- | --- |
| **Script** | `generate-model-documentation.ps1` |
| **Invoker** | Invoked by the developer after **change** to the **models** |
| **Input** | `/app` |
| **Output** | `/docs/_model/**` |
| Log | **N/A** - The script writes to the terminal |

**Usage**

```powershell
# Generate/update model documentation
. ./scripts/generate-model-documentation.ps1

# Force regenerate all documentation
. ./scripts/generate-model-documentation.ps1 -Force
```

### Local CI/CD Build Simulation

Simulates the GitHub continuous deployment build pipeline locally, allowing validation that changes will build successfully before pushing to GitHub.

**Script properties**

| Property | Value |
| --- | --- |
| **Script** | `Invoke-LocalCDBuild.ps1` |
| **Invoker** | Invoked by the developer after **code changes** to validate the build |
| **Input** | Git repository, branch name, `.npmrc` file (all auto-detected) |
| **Output** | **N/A** - Temp directory is cleaned up automatically |
| **Log** | **N/A** - The script writes to the terminal |

**Usage**

All parameters are auto-detected from your current working directory if not provided:

```powershell
# Run with all parameters auto-detected from current git repo
./scripts/Invoke-LocalCDBuild.ps1

# Or specify parameters explicitly
./scripts/Invoke-LocalCDBuild.ps1 `
  -RepositoryUrl "https://github.com/museumwithnofrontiers/inventory-app.git" `
  -BranchName "main" `
  -NpmrcPath "$HOME\.npmrc"
```

**Parameters**

- **RepositoryUrl** (optional): Git repository URL. Auto-detected from `git remote origin` if not provided.
- **BranchName** (optional): Branch name to checkout. Auto-detected from current branch if not provided.
- **NpmrcPath** (optional): Path to `.npmrc` file. Defaults to `$HOME\.npmrc` if not provided.

**What it does**
1. Checks for uncommitted or staged changes (fails if any exist)
2. Verifies `.npmrc` file exists
3. Clones repository to temp directory
4. Checks out the specified branch
5. Installs PHP and NPM dependencies (production flags)
6. Builds backend assets
7. Cleans up temporary files

**Exit codes**
- **0**: Success
- **1**: Failure (see error message)

### Development helpers

#### Image seeding

Downloads and stores a set of images from the internet to avoid repeating this time consuming when seeding the database.

**Script properties**

| Property | Value |
| --- | --- |
| Script | `download-seed-images.ps1` |
| Invoker | Invoked by the developer **once** |
| Input | [https://picsum.photos](https://picsum.photos) |
| Output | `/database/seeders/data/images` |
| Log | **N/A** - The script writes to the terminal |

**Links**

| Reference | Url |
| --- | --- |
| Lorem Picsum, The Lorem Ipsum for photos. | [https://picsum.photos](https://picsum.photos) |

**Usage**

```powershell
. ./scripts/download-seed-images.ps1
```

#### Migration testing

Runs database migration back and forth a small number of times to help detect issues.
It uses an array of environment files to run the tests in multiple environments.

**Script properties**

| Property | Value |
| --- | --- |
| Script | `test-migrations.ps1` |
| Invoker | Invoked by the developer after a **change** to the **migrations** |
| Input | `/database/migrations` |
| Output | **N/A** - The script writes to the terminal |
| Log | **N/A** - The script writes to the terminal |

**Usage**

```powershell
. ./scripts/test-migrations.ps1
```

#### Validation of the Workflow files

Validates all YAML workflow files.

**Script properties**

| Property | Value |
| --- | --- |
| Script | `validate-workflows.cjs` |
| Invoker | Invoked by the developer after a **change** to workflow's **`*.yml`** files using `node ./scripts/validate-workflows.cjs`. See [/.github/workflows/README.md](../.github/workflows/README.md) |
| Input | `/.github/workflows` |
| Output | **N/A** - The script writes to the terminal |
| Log | **N/A** - The script writes to the terminal |

**Links**

| Reference | Url |
| --- | --- |
| npx, Run a command from a local or remote npm package | [https://docs.npmjs.com/cli/v9/commands/npx?v=true](https://docs.npmjs.com/cli/v9/commands/npx?v=true) |

**Usage**

```powershell
node scripts/validate-workflows.cjs
```

#### Running tests in parallel

Run all tests suites in parallel.

**Script properties**

| Property | Value |
| --- | --- |
| Script | `Start-Tests.ps1` |
| Invoker | Invoked by the developer to efficiently run all tests after a **change** to the **code** |
| Input | /tests, /resource/js/**/__tests__ */ |
| Output | **N/A** - The script writes to the terminal |
| Log | **N/A** - The script writes to the terminal |

**Usage**

```powershell
.\Scripts\Start-Tests.ps1
```