# Organization site list

`list-sites.mjs` writes the `sites.json` that the organization site,
<https://museumwithnofrontiers.github.io>, renders (repository
[museumwithnofrontiers.github.io](https://github.com/museumwithnofrontiers/museumwithnofrontiers.github.io),
submodule `.new-architecture/museumwithnofrontiers.github.io`).

- **Which sites:** every public, unarchived repository created from one of the
  three site templates (`museumwithnofrontiers/website-template`,
  `gallery-template`, `exhibition-template`) that has GitHub Pages enabled.
  This is the rule `propagate.mjs` (viewer-workflows) uses, so there is no list
  to keep by hand.
- **Title and kind:** from the exporter instance with the same slug
  (`scripts/exporters/instances/<slug>.json`: `name`, `kind`). A site with no
  instance is still listed, under its repository name, in "Other websites".
- **Address:** from the repository's GitHub Pages settings.

It refuses to write an empty list: finding no site means a wrong `--owner`
or a `gh` that isn't logged in.

## Run it

From the inventory-app root (PowerShell), with your own `gh` login:

```powershell
docker run --rm -e GH_TOKEN=$(gh auth token) -v "${PWD}:/w" -w /w node:lts-alpine sh -c "apk add --no-cache github-cli >/dev/null && node scripts/org-site/list-sites.mjs"
```

It writes `.new-architecture/museumwithnofrontiers.github.io/sites.json`
(`--out <file>` writes elsewhere, and `--owner <org>` reads another owner).
Commit that file in the submodule's repository, on a branch, through a pull
request: merging it deploys the page. Step 9 of
[the new-website recipe](../../docs/deployment/new-website.md) runs this for
every new website.

## Test

```powershell
docker run --rm -v "${PWD}:/w" -w /w node:lts-alpine node --test scripts/org-site/list-sites.test.mjs
```
