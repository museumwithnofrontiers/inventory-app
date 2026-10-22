---
layout: default
title: Inventory MCP Server
nav_order: 21
---

# Inventory MCP Server

The inventory has a **read-only** [Model Context Protocol](https://modelcontextprotocol.io) server, so an AI assistant can browse it: items, collections, partners, their translations, images and reference data. No tool changes anything.

It acts as a user, and that user's permissions and the policies decide what it sees, exactly as in the panel. Using it requires the `access-mcp` permission. Every role that may enter the panel has it.

## Two ways to connect

| Transport | Where | Who it acts as |
| --- | --- | --- |
| HTTP | `https://<host>/mcp/inventory` | The user who approved the app, through OAuth |
| Artisan (stdio) | `php artisan mcp:start inventory`, inside the app container | The user named by `MCP_LOCAL_USER` |

### HTTP, with OAuth

The server is protected by the app's own OAuth 2.1 server (Laravel Passport). A client needs nothing but the URL:

1. It calls the server, gets `401` with a `WWW-Authenticate` header pointing at `/.well-known/oauth-protected-resource/mcp/inventory`, and discovers the authorization server from there.
2. It registers itself at `/oauth/register` (public client, authorization code with PKCE). Redirect URIs are limited to localhost, `claude.ai` and `claude.com` (`MCP_REDIRECT_DOMAINS` overrides the list).
3. It sends you to sign in on the panel, with MFA, then to a consent page that shows the app, the `mcp` scope and where your answer goes.
4. Once you approve, it receives a short-lived access token and a refresh token.

To add it to Claude Code:

```bash
claude mcp add --transport http mwnf-inventory https://inventory.metanull.eu/mcp/inventory
```

The apps you approved are listed on **Connected apps**, reached from your profile or the user menu. **Revoke** ends an app's access at once.

### Artisan, for local development

The stdio transport has no sign-in, so it acts as a configured user. Set `MCP_LOCAL_USER` to the e-mail of a user holding `access-mcp`. The server refuses to start without one.

```bash
docker compose exec -T -e MCP_LOCAL_USER=user@example.com app php artisan mcp:start inventory
```

To register it in Claude Code with the development stack running:

```bash
claude mcp add mwnf-inventory-local -- docker compose exec -T -e MCP_LOCAL_USER=user@example.com app php artisan mcp:start inventory
```

## Tools

| Tool | What it returns |
| --- | --- |
| `whoami` | The user the session acts as, their roles and permissions, the connection (HTTP client and scopes, or local), and the tools they may use |
| `list_entity_types` | The entity types (items, collections, partners, their translations and images, reference data…) and whether you may read each |
| `describe_entity` | A type's fields (usable as filters), searched fields, includes, and whether it has translations, `extra` or a legacy key |
| `search` | Records of one type: free text over id, internal name, legacy key and name; exact-match filters; paginated like the API |
| `get` | One record by id, shaped like the API's, with the includes asked for |
| `get_item` | An item sheet: translations per language and context, images (public URL and copyright), partner, project, collections, tags, artists, workshops, dynasties, parent, children, links |
| `get_collection` | A collection with translations, parent, children and partners, and a page of its members (native and attached items, as the websites list them) |
| `find_by_legacy_key` | What a legacy record was imported as, across every type you may read (exact or prefix match on `backward_compatibility`) |
| `view_image` | An attached image's burned rendition, as the public sees it. Only a cached rendition unless `allow_burn` is set; never an original |

### Observing the image pipeline

These need `view data`. None writes to a disk or a table, burns a rendition or returns an original's bytes.

| Tool | What it returns |
| --- | --- |
| `image_pipeline_status` | One overview, stage by stage: uploads waiting (and stuck), the available pool, attached images per model with missing originals, orphaned files on the originals disk and in the pictures cache, the queue |
| `trace_image` | One image by id, filename or `/pub` URL: its stage, owner, original (present, size, checksum), copyright and its source (image, project or fallback), cached rendition (fresh, stale, unmarked or missing) and public URL |
| `list_pending_uploads` | Uploads not yet processed, with their age and whether their file is still there |
| `list_available_images` | The pool of processed images waiting to be attached, with their age and original |
| `audit_attached_images` | The same audit as `images:attached-registry-audit`: registry contract, rows, missing originals, duplicate and empty paths |
| `find_orphans` | Unreferenced files on the originals disk or in the pictures cache (report only; the cleanup commands remove them) |
| `list_stale_renditions` | Cached renditions burned for an older copyright or burner version; each is re-burned on its next request |
| `queue_status` | The queue connection, waiting jobs and recent failed jobs |

Everything is read through the existing permissions and policies: a type is readable through its model's policy where it has one, otherwise with `view data`, as on the API's read routes. Users, roles, permissions and settings are not offered.

## For developers

- Server: `App\Mcp\Servers\InventoryServer`; tools in `app/Mcp/Tools`; routes in `routes/ai.php`.
- Every tool must carry `#[IsReadOnly]`. A test lists `InventoryServer::TOOLS` and fails otherwise.
- Tools authorize through the existing policies and permissions. They never bypass or duplicate them.
- Tests: `tests/Api/Mcp`. `Tests\Traits\IssuesOAuthTokens` obtains real tokens through the consent flow.
