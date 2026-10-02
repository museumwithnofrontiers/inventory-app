---
layout: default
title: Architecture Decisions
nav_order: 80
has_children: true
permalink: /adr/
---

# Architecture Decisions

Each record states a decision that shapes the codebase, the context that led to it, and what follows from it. Read one before reversing what it decided.

| Record | Decision |
|---|---|
| [ADR 003 — The Filament panel is the only UI](003-filament-only-admin) | `/web` is retired; `/admin` is the application's only UI and `/` redirects to it. Fortify stays, Jetstream goes. |

Numbers follow the plans that scheduled each record. 001 and 002 were never written.
