# New Test Structure

This directory contains the test suite of the two interfaces, the REST API and the Filament admin panel (/admin), and of the code behind them.

## Directory Structure

```
tests/
├── Api/                              # REST API Backend Tests
│   ├── Resources/                    # Resource/endpoint tests (one file per resource)
│   │   ├── ItemTest.php             # All Item API tests (index, show, store, update, destroy, tags, scopes)
│   │   ├── PartnerTest.php          # All Partner API tests
│   │   └── ...                      # One test file per API resource
│   ├── Traits/                       # Reusable test traits
│   │   ├── AuthenticatesApiRequests.php  # API authentication setup
│   │   ├── TestsApiCrud.php         # Standard CRUD operations
│   │   ├── TestsApiImageResource.php # Image resource operations
│   │   ├── TestsApiImageViewing.php # Image download/view operations
│   │   └── TestsApiTagManagement.php # Tag management operations
│   ├── Authentication/               # Mobile token endpoints, their two-factor flow
│   └── Middleware/                   # API middleware & security tests
│       ├── AuthenticationTest.php   # Sanctum token validation, unauthenticated rejection
│       ├── AuthorizationMiddlewareTest.php # The permission and role middleware themselves
│       └── PermissionsTest.php      # Permission-based authorization (VIEW_DATA, CREATE_DATA, etc.)
│
├── Pub/                              # /pub/{filename}, the public picture URL (Api suite)
│
├── Filament/                         # The admin panel: resources, relation managers, pages, widgets
│   ├── Authorization/               # Panel access, per-resource authorization, MFA
│   └── Pages/                       # Login, registration, verification, two-factor, profile, API tokens
│
├── Unit/                             # Pure unit tests (business logic)
│   ├── Models/                       # Model method tests
│   │   ├── ItemTest.php             # Item model methods, relationships
│   │   ├── ItemScopesTest.php       # Item query scopes
│   │   └── ...                      # One test file per model
│   ├── Services/                     # Service class tests
│   │   └── MarkdownServiceTest.php  # Service business logic
│   ├── Jobs/                         # Queue job tests
│   │   └── SyncSpellingsTest.php    # Job logic (mocked dependencies)
│   ├── Requests/                     # FormRequest validation tests
│   │   ├── StoreItemRequestTest.php # Validation rules only
│   │   └── ...                      # One test file per FormRequest
│   └── Factories/                    # Factory state tests
│       └── FactoriesTest.php         # Factory states (Object, Monument, etc.)
│
├── Integration/                      # Cross-cutting integration tests
│   └── GlossarySyncTest.php         # Complex multi-step workflows
│
└── Console/                          # Artisan command tests
    └── CommandsTest.php             # All console commands
```

## Organization Principles

### 1. Domain Over Technical
- Tests organized by business domain (Items, Partners, etc.)
- NOT by HTTP method (Index, Store, Update, etc.)
- One file contains ALL tests for a resource's feature area

### 2. Clear API/Panel Separation
- `Api/` - REST API backend (JSON responses, authentication tokens)
- `Filament/` - the admin panel (Livewire pages, sessions, redirects)
- Never mixed - these are independent interfaces

### 3. Single Responsibility Per File
- Each test file has ONE feature responsibility
- BUT contains ALL tests for that feature
- Each test method still tests ONE thing

### 4. Middleware Tests - Centralized Security Validation
- **Api/Middleware/** contains cross-cutting security tests; the panel's live under **Filament/Authorization/**
- Tests ALL routes systematically to ensure proper protection
- **AuthenticationTest.php** - Verifies ALL routes reject unauthenticated requests
- **PermissionsTest.php** - Verifies ALL routes enforce correct permissions (VIEW_DATA, CREATE_DATA, UPDATE_DATA, DELETE_DATA)
- **Why separate from Resources/Pages?** - Resource tests assume authenticated user with proper permissions; Middleware tests verify that assumption is enforced
- **Benefits:**
  - One place to verify security across ALL endpoints
  - Easy to add new routes to security checks
  - Catches missing middleware configurations
  - Complements trait-based tests that use super-users

### 5. Test What You Built, Not The Framework
- No tests for basic Laravel validation
- Focus on business logic, custom rules, workflows
- FormRequest validation tested in Unit/Requests/

## File Naming Conventions

- **Resource tests**: Plural noun + "Test" (e.g., `ItemsTest.php`, `PartnersTest.php`)
- **Feature tests**: Feature name + "Test" (e.g., `LoginTest.php`, `ImageUploadWorkflowTest.php`)
- **Unit tests**: Class name + "Test" (e.g., `ItemTest.php` for Item model, `ItemScopesTest.php` for scopes)

## Documentation and guidelines

- Every directory includes a README.md with specifics details about itself.


## Migration Status

This is a work-in-progress migration from the old `tests/` structure. Each test is being reviewed and moved to its appropriate location in this new structure.

Tests that don't fit the new organization (low-value framework tests) are marked clearly for review/deletion.
