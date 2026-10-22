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

## For developers

- Server: `App\Mcp\Servers\InventoryServer`; tools in `app/Mcp/Tools`; routes in `routes/ai.php`.
- Every tool must carry `#[IsReadOnly]`. A test lists `InventoryServer::TOOLS` and fails otherwise.
- Tools authorize through the existing policies and permissions. They never bypass or duplicate them.
- Tests: `tests/Api/Mcp`. `Tests\Traits\IssuesOAuthTokens` obtains real tokens through the consent flow.
