---
layout: default
title: Development Archive Documentation Generator
nav_order: 4
parent: Backend Guidelines
---

# Development Archive Documentation Generator

Automatic generation of a documentation for Git commits on the main branch.

## Files

- `generate-commit-docs.py` - Python script for generating commit documentation
- `.github/workflows/generate-commit-docs.yml` - GitHub Actions workflow for automation
- `_docs/` - Directory containing generated commit documentation
- `_config.yml` - Jekyll configuration for GitHub Pages

## How it Works

1. **Automated Processing**: GitHub Actions workflow triggers on:
   - Every push to main branch
   - Daily at 2 AM UTC
   - Manual workflow dispatch
2. **Documentation Generation**: The Python script:
   - Processes commits from the repository
   - Creates individual markdown files for each commit
   - Updates the documentation index
3. **Site Building**: Jekyll builds the static site
4. **Deployment**: Automatically deploys to GitHub Pages

## Key Features

- **Commit Documentation**: Each commit gets its own markdown file with:
  - Commit metadata (hash, date, author, message)
  - List of changed files with status indicators
  - Links to GitHub commit view
- **Automated Updates**: No manual intervention required
- **GitHub Pages Integration**: Documentation is automatically published

## Output Structure

```
_docs/
├── index.md                           # Index of all commits
├── YYYYMMDDHHMMSS-{short_hash}-{sanitized_title}.md
└── ...
```

## File Naming Convention

`YYYYMMDDHHMMSS-{short_hash}-{sanitized_title}.md`

- Timestamp (YYYYMMDDHHMMSS) ensures chronological ordering
- Short hash provides unique identification
- Sanitized title improves readability

## Requirements

### For Local Development

- Python 3.x
- Ruby 3.4 (for Jekyll), matching `.docker/Dockerfile.docs` and `docs/Gemfile`
- Bundler gem installed

### For GitHub Actions (handled automatically)

- GitHub repository with Actions enabled
- GitHub Pages configured
- Appropriate permissions:
  - `contents: read`
  - `pages: write`
  - `id-token: write`

## Local Testing

1. Install Ruby dependencies:

   ```bash
   cd docs
   bundle install
   ```

2. Generate documentation:

   ```bash
   python scripts/generate-commit-docs.py
   ```

3. Build Jekyll site:
   ```bash
   cd docs
   bundle exec jekyll build
   ```

The site will be generated in `docs/_site/`.

## GitHub Action for CI/CD

### Yaml

The following GitHub Action pipeline can be used to automate the generation of the GitHub
Page website, including a documentation of the history of the repostory in your CI/CD
pipelines.

{: .note }

> **Python script for the generation of the pages**: [generate-commit-docs.py](https://github.com/metanull/inventory-app/blob/main/scripts/generate-commit-docs.py)

```yaml
name: Generate Commit Documentation

on:
  push:
    branches: [main]
  schedule:
    # Run every day at 2 AM UTC
    - cron: "0 2 * * *"
  workflow_dispatch:
    # Allow manual triggering

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
# However, do NOT cancel in-progress runs as we want to allow these production deployments to complete.
concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest

    # Override workflow permissions for this job to include contents: write for committing
    permissions:
      contents: write
      pages: write
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch full history for commit analysis
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Git
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.x"

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: "3.4"
          working-directory: docs

      - name: Install Ruby dependencies
        run: |
          cd docs
          bundle install

      - name: Generate documentation of the latest commits
        run: |
          python scripts/generate-commit-docs.py

      - name: Build Jekyll site
        run: |
          cd docs
          bundle exec jekyll build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/_site

  deploy:
    needs: build

    permissions:
      contents: read
      pages: write
      id-token: write

    # Set the environment to github-pages for proper recognition
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    runs-on: ubuntu-latest

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
