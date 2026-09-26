---
layout: default
title: Filament Admin Frontend
nav_order: 40
has_children: true
permalink: /frontend-filament/
---

# Filament Admin Frontend

Filament `/admin` is the only active back-office UI (see [Filament Back-Office]({{ '/collaborators/filament-admin' | relative_url }}) for the authorization model and where to work in the codebase). This section holds deeper, feature-level design notes for the Filament frontend — the kind of document that records *why* a pipeline is shaped the way it is, not just how to use it.

## Pages

- [Document Upload Pipeline]({{ '/frontend-filament/document-upload' | relative_url }}) — the design for uploading, validating and attaching `ItemDocument` files from the Item page.
