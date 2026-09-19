---
layout: default
title: Contributing
nav_order: 2
parent: Development
---

# Contributing Guidelines

Thank you for contributing to the Inventory Management System. This page covers what matters most: quality standards, the PR workflow, and how the versioning system works.

## Setting Up

If you haven't set up your local environment yet, follow the [Development Setup]({{ '/deployment/development-setup' | relative_url }}) guide first.

The quickest way to get a clean, seeded database:

```bash
composer ci-reset
```

## Quality Standards

Before submitting a pull request, make sure:

- [ ] All tests pass — `composer ci-test`
- [ ] All linters pass — `composer ci-lint:test`
- [ ] The build succeeds — `composer ci-build`
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat:`, `fix:`, `docs:`, `test:`)
- [ ] Your branch is up to date with `main` and has no merge conflicts

## PR Labels and Versioning

Labels on your pull request control the automatic version bump:

| Label             | Version bump | When to use                                                                          |
| ----------------- | ------------ | ------------------------------------------------------------------------------------ |
| `bugfix`          | Patch        | Bug fixes, refactoring, doc improvements, test improvements                          |
| `feature`         | Minor        | New endpoints, new entities, new UI features                                         |
| `breaking-change` | Major        | Removed/changed endpoints, changed request/response formats, breaking schema changes |

- **Default** (no label): patch bump
- **Priority**: `breaking-change` > `feature` > `bugfix`
- The version bump commit appears in your PR automatically after CI passes
- Never manually edit version numbers

## Contribution Workflow

1. Create a branch: `feature/your-feature-name` or `fix/bug-description`
2. Make your changes following existing patterns — see [Coding Guidelines]({{ '/guidelines/coding-guidelines' | relative_url }})
3. Add tests — see [Testing Guide](testing)
4. Run `composer ci-before:pull-request` to validate everything locally
5. Push and open a pull request

## Code Review

Reviewers focus on:

- **Correctness** — does the change do what it claims?
- **Patterns** — does it follow existing conventions?
- **Tests** — are new behaviours covered?
- **Security** — proper validation, authentication, and authorisation
- **Performance** — efficient queries, no N+1 problems

## Getting Help

- [GitHub Issues](https://github.com/museumwithnofrontiers/inventory-app/issues) — Bug reports and feature requests
- [GitHub Discussions](https://github.com/museumwithnofrontiers/inventory-app/discussions) — Questions and general discussion

---

_Last updated: {{ site.time | date: "%B %d, %Y" }}_
