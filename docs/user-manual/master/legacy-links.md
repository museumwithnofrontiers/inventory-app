---
layout: default
title: 7. Legacy links
parent: Master manual
grand_parent: User Manual
nav_order: 7
---

# 7. Legacy links

Every item, collection and partner came from a legacy database. Its view page has a **Legacy links** section that points to the same record on the legacy websites and in the legacy back-office (the Virtual Office). Use them to compare a record with what legacy showed, or to check where a text came from.

![The legacy links of the Water in Islam exhibition]({{ '/user-manual/images/legacy-links.png' | relative_url }})

Each link shows:

- its **title**, for example *Thematic gallery landing page*, *Legacy object page*, *Thematic exhibition object page*;
- its **type** and **confidence**, for example *Public - Exact*;
- the address;
- its **Source**: the legacy code it was built from.

| Type | Meaning |
|---|---|
| **Public** | A page of a public legacy website. |
| **Back-office** | The record in the Virtual Office. It needs the MWNF VPN. |
| **Source** | A related legacy page, when the record is shown on a site that is not its own. |
| **Diagnostic** | No address could be built yet. The text under it says what is missing. |

| Confidence | Meaning |
|---|---|
| **Exact** | The address is built from the record's own legacy code. |
| **Inferred** | The address also uses the record's project, parent collection or country. |
| **Requires lookup** | Legacy data the inventory doesn't hold (a slug, a parent location) is needed. The link is shown as a diagnostic. |
| **Unsupported** | No rule exists yet for this kind of record. |

An object shown in several legacy galleries and exhibitions has one public link per page, as the *Aleppo Room* does. The links are computed from the legacy code each time the page opens: there is nothing to edit, and they don't change the websites.

The rules behind the links are described in [Legacy URL Mapping]({{ '/understanding/legacy-url-mapping' | relative_url }}).
