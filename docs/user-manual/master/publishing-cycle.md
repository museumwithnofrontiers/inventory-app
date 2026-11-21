---
layout: default
title: 8. From the panel to the website
parent: Master manual
grand_parent: User Manual
nav_order: 8
---

# 8. From the panel to the website

The websites never read the inventory directly. They are static sites, rebuilt from **data packages** that the team produces from the inventory. So a change you save in the panel is in the inventory at once, but it reaches a website only after three steps the team runs:

```
panel (you)  ──save──▶  inventory
                           │  1. export      the exporters read the inventory
                           ▼
                     data packages            one package per website
                           │  2. publish     a reviewed pull request releases them
                           ▼
                     published packages
                           │  3. propagate   each website takes the new version
                           ▼
                        websites              rebuilt and deployed
```

1. **Export.** One exporter per site family reads the inventory and writes the site's data package: its items, collections, partners, texts and image addresses. The [site family manuals]({{ '/user-manual/sites/' | relative_url }}) explain what each exporter reads.
2. **Publish.** The team reviews the differences and publishes the new package versions.
3. **Propagate.** Each website receives a pull request that moves it to the new version. When it is merged, the site is rebuilt and deployed.

The global search follows the same path, with one more step: its index is reloaded from the published search package.

You don't run these steps. Tell the team when your edits are ready to go out, and which sites they concern. The details of each step are in [Release and Propagation]({{ '/deployment/release-and-propagation' | relative_url }}).

## What doesn't wait for an export

**Images.** A picture's public address, `/pub/<file name>`, is served by the inventory itself. When you change the line burned on a picture, the next visitor receives the new version. A newly attached image, or a detached one, still needs the export: the package says which pictures a page shows.

## Re-imports from legacy

While the content was being moved from the legacy databases, the team re-imported it several times. A re-import **rebuilds the whole inventory** from legacy: an edit made in the panel since the previous re-import is not kept. Before you start editing a site, ask the team whether another re-import is planned, and whether your change should be made in legacy instead, until the panel is the only place where that content is maintained.

## Checking your change

- In the panel, open the record again: the view page shows what was saved.
- After the team has propagated, open the page on the website. If the change is missing, tell the team which record you changed (its UUID or legacy code) and on which page you expected it.
