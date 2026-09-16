---
layout: default
title: Legacy Blade/Livewire Frontend
nav_order: 90
has_children: true
permalink: /frontend-blade/
---

# Legacy Blade/Livewire Frontend

{: .important }

> This section is retained as a legacy technical archive. Filament `/admin` is now the main back-office.

## What You Can Do

The legacy `/web` interface was the first integrated back-office. New back-office work belongs in Filament `/admin`. Use this section only when you maintain or retire existing `/web` behavior.

The legacy interface contains features to:

- **Browse and search** items, partners, collections, projects, and all other entities
- **Create and edit** inventory records with full validation and multi-language support
- **Organise content** into collections, exhibitions, galleries, and thematic trails
- **Upload and manage images** - attach photos to items, collections, and partners
- **Manage users and permissions** - control who can view, create, edit, or delete records

Each entity type is colour-coded for visual clarity, making it easy to navigate between different areas of the system.

## How It Works

The interface is server-rendered: pages are built on the server and delivered as complete HTML. Interactive elements (inline editing, toggling, image management) use Livewire and Alpine.js to update the page without full reloads.

For development setup instructions, see the [Development Setup]({{ '/deployment/development-setup' | relative_url }}) guide.

## Developer Documentation

The sections below cover how the frontend is built. They are useful for developers extending or retiring the interface.

- **[Components]({{ '/frontend-blade/components/' | relative_url }})** - Reusable Blade components (forms, tables, cards, buttons, etc.)
- **[Livewire]({{ '/frontend-blade/livewire/' | relative_url }})** - Reactive component patterns
- **[Alpine.js]({{ '/frontend-blade/alpine/' | relative_url }})** - Client-side interaction patterns
- **[Styling]({{ '/frontend-blade/styling/' | relative_url }})** - Tailwind CSS conventions and entity colour system
- **[Views]({{ '/frontend-blade/views' | relative_url }})** - Page structure and entity views
- **[Routing]({{ '/frontend-blade/routing' | relative_url }})** - Web route conventions
- **[Guidelines]({{ '/frontend-blade/guidelines' | relative_url }})** - Frontend development standards
- **[Testing]({{ '/frontend-blade/testing' | relative_url }})** - How to test frontend components

## Related Documentation

- [Core Model]({{ '/understanding/core-model' | relative_url }}) - Understand the business model
- [Database Models]({{ '/models/' | relative_url }}) - Data structure reference
- [Management API Reference]({{ '/api/' | relative_url }}) - REST API for programmatic access
