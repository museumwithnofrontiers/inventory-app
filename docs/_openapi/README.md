# The REST API's OpenAPI document

**`api.json` is generated. Never edit it by hand:** CI regenerates it on every pull request that touches the backend and fails when the committed file differs.

## Files

- `api.json`: the OpenAPI 3.1 document of the REST API (`/api`). Generated.
- `swagger-ui.html`: the Swagger UI shell that renders it on the documentation site. Written by hand.

## Regenerating

After any change to API routes, controllers, Form Requests or API Resources, run this in the dev container:

```bash
composer ci-openapi-doc
```

This runs `php artisan docs:openapi`, which:

1. migrates a throwaway SQLite file, never the configured database. [Scramble](https://scramble.dedoc.co) reads each model's table to type the API resources, so the document must not depend on the state of a local database;
2. pins the URLs the document embeds to `http://localhost`, whatever `APP_URL` says;
3. writes `docs/_openapi/api.json` with `scramble:export`.

Commit the result together with the code change.

## Where it comes from

Scramble reads the code; no annotations are needed:

- **paths and parameters:** `routes/api.php`. Every API route has a name, which becomes its operationId: a PUT route that duplicates a PATCH one is named `<name>.put`, such as `artist.update.put`;
- **request bodies:** the Form Requests (`app/Http/Requests/Api/`), and the `include` parameter through `IncludeRuleTransformer`;
- **responses:** the API Resources (`app/Http/Resources/`) and the model tables;
- **summaries:** the controller methods' PHPDoc.

`app/Support/Documentation/` adds what Scramble cannot infer:

- `OperationTransformers\RouteSecurity`: each operation's security, from its route's middleware. No `auth` middleware means public; `scopes:` and `scope:` give the OAuth scopes the token needs.
- `OperationTransformers\CreatedStatus`: `store*` actions answer 201.
- `TypeToSchemaExtensions\FileResponseToSchema`: image and file responses are binary.

`AppServiceProvider` declares the OAuth 2.1 authorization-code scheme and its scopes (`App\Enums\OAuthScope`).

## Publishing

The documentation site's plugin (`docs/_plugins/copy_static_files.rb`) copies both files to the site root:

- `https://museumwithnofrontiers.github.io/inventory-app/api.json`
- `https://museumwithnofrontiers.github.io/inventory-app/swagger-ui.html`

The application itself serves the document only through Scramble's `/docs/api` pages, behind `CustomRestrictedDocsAccess` (`API_DOCS_ENABLED`).
