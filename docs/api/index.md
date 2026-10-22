---
layout: default
title: Management API Reference
nav_order: 20
has_children: true
permalink: /api/
---

# Management API Reference

The current REST API is the authenticated management API. It lets trusted clients read and manage Inventory data programmatically. It is **switched off** unless `API_ENABLED` is set; while off, every `/api` URL answers 404. When on, all endpoints require an OAuth 2.1 bearer token (Laravel Passport, authorization code with PKCE, scope `api:read` or `api:write`), except for health and version checks. See [Authentication and Permissions]({{ '/concepts.html' | relative_url }}#authentication-and-permissions).

The future read-only API is a separate design area. It should optimize public content delivery and should not be confused with this management API.

## Quick Access

- [Interactive API Explorer (Swagger UI)]({{ '/swagger-ui.html' | relative_url }}) - Browse and test endpoints directly
- [OpenAPI Specification]({{ '/api.json' | relative_url }}) - Download the full specification (JSON)

## Interactive Documentation

<iframe src="{{ '/swagger-ui.html' | relative_url }}" width="100%" height="800px" frameborder="0" style="border: 1px solid #ddd; border-radius: 4px;"></iframe>

## What the API Offers

- **Full CRUD** on all inventory entities (items, partners, collections, projects, etc.)
- **Multi-language translations** - create and retrieve content in any language and audience context
- **Image management** - upload, process, and attach images to items, collections, and partners
- **Hierarchical collections** - organise items into exhibitions, galleries, thematic trails, and more
- **Tags** - flexible, ad-hoc categorisation of items
- **Search and pagination** - filter and page through large result sets

### System Endpoints

- `GET /api/info` - Application information
- `GET /api/health` - Health check (no auth required)
- `GET /api/version` - Current application version (no auth required)

### Image Workflow

Images flow through a three-stage pipeline:

1. **Upload** - `POST /api/image-upload` uploads a file for processing.
2. **Processing** - the system resizes and optimises the image in the background.
3. **Attachment** - attach the processed image to an item, collection, or partner.

See [Core Model]({{ '/understanding/core-model' | relative_url }}) for the business meaning of images and picture Items.
