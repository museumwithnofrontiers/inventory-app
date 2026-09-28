# NPM Package Publishing Guide

How `--publish` releases `@museumwnf/galleries-data` on npmjs. What the
package contains is in [`README.md`](README.md) and
[`../docs/galleries-hub-data-package.md`](../docs/galleries-hub-data-package.md).
The mechanics are the same as every other exporter's; the full guide, with
the npmjs authentication details and troubleshooting, is
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md).

## Quick start

```bash
docker compose --profile jobs run --rm exporter galleries --force --publish --base-url https://inventory.metanull.eu
```

That one run:
1. exports the hub to `output/galleries/`;
2. computes the next version: the registry's version plus one, or the local counter `output/.version-galleries`;
3. generates `package.json`, a consumer `README.md` and `LICENSE.md` in `output/galleries/`;
4. runs `npm publish` from that directory.

There is no separate manual `npm publish` step.

## The first publish

The first publish of a new package name needs an interactive npmjs session
in the container, because trusted publishing can only be configured for a
name that already exists:
- **Session:** mount the operator's `~/.npmrc` (on Windows, set `$env:HOME`
  first; the compose file explains why).
- **Web login:** when npmjs asks for its extra web-login step, npm prints a
  `https://www.npmjs.com/auth/cli/…` URL instead of opening a browser. The
  operator opens it in their own browser and approves it.

Everything after the first publish follows the release procedure in
[`docs/deployment/release-and-propagation.md`](../../../docs/deployment/release-and-propagation.md).

## Version file

`output/.version-galleries` is gitignored and is written only after
`npm publish` has succeeded, so a failed publish never burns a number. If
the file is lost, the next `--publish` asks the registry first.
`--package-version <semver>` sets an explicit version.
