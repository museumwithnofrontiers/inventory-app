# API Test Traits

## Purpose

Reusable test traits that provide standard test methods for common API patterns. These traits implement the DRY principle by eliminating repetitive test code across resource tests.

## Available Traits

### AuthenticatesApiRequests.php
**Purpose:** Sets up authenticated API requests with an OAuth (Passport) token carrying the `api:read` and `api:write` scopes

**Provides:**
- Authenticated user with ALL permissions (VIEW_DATA, CREATE_DATA, UPDATE_DATA, DELETE_DATA)
- `Passport::actingAs()` authentication
- Automatic permission cache clearing

**Usage:**
```php
use Tests\Api\Traits\AuthenticatesApiRequests;

class ItemTest extends TestCase
{
    use AuthenticatesApiRequests;  // Automatically authenticates all requests
    
    // All API calls in this test are now authenticated
}
```

**When to use:** Every API resource test file

---

### TestsApiCrud.php
**Purpose:** Standard CRUD operation tests for API resources

**Provides 9 test methods:**
1. `test_can_list_resources()` - GET /api/{resource}
2. `test_index_returns_empty_when_no_resources()` - Empty collection
3. `test_can_show_single_resource()` - GET /api/{resource}/{id}
4. `test_show_returns_404_for_nonexistent_resource()` - 404 handling
5. `test_can_create_resource()` - POST /api/{resource}
6. `test_can_update_resource()` - PUT /api/{resource}/{id}
7. `test_update_returns_404_for_nonexistent_resource()` - 404 on update
8. `test_can_delete_resource()` - DELETE /api/{resource}/{id}
9. `test_destroy_returns_404_for_nonexistent_resource()` - 404 on delete

**Required methods to implement:**
```php
abstract protected function getResourceName(): string;  // Route name (e.g., 'item')
abstract protected function getModelClass(): string;    // Model class (e.g., Item::class)
```

**Optional methods to override:**
```php
protected function getFactoryData(): array {
    return [];  // Additional data for factory
}

protected function getUpdateData(): array {
    return $this->getModelClass()::factory()->make()->toArray();  // Data for updates
}
```

**Usage:**
```php
use Tests\Api\Traits\TestsApiCrud;

class ItemTest extends TestCase
{
    use TestsApiCrud;
    
    protected function getResourceName(): string { return 'item'; }
    protected function getModelClass(): string { return Item::class; }
}
```

---

### TestsApiTagManagement.php
**Purpose:** Tag attachment/detachment/sync operations for taggable resources

**Provides 3 test methods:**
1. `test_can_attach_tags_to_resource()` - POST /api/{resource}/{id}/tags/attach
2. `test_can_detach_tags_from_resource()` - POST /api/{resource}/{id}/tags/detach
3. `test_can_sync_tags_on_resource()` - POST /api/{resource}/{id}/tags/sync

**Required methods to implement:**
```php
abstract protected function getResourceName(): string;
abstract protected function getModelClass(): string;
```

**Usage:**
```php
use Tests\Api\Traits\TestsApiCrud;
use Tests\Api\Traits\TestsApiTagManagement;

class ItemTest extends TestCase
{
    use TestsApiCrud;
    use TestsApiTagManagement;  // Adds tag tests
    
    protected function getResourceName(): string { return 'item'; }
    protected function getModelClass(): string { return Item::class; }
}
```

**When to use:** Resources that implement the Taggable interface (Items, Collections, Partners)

---

### TestsApiImageResource.php
**Purpose:** CRUD and ordering operations for image resources

**Provides 15 test methods:**
- All standard CRUD operations (9 tests)
- `test_can_move_image_up()` - PATCH /api/{resource}/{id}/move-up
- `test_move_up_at_top_has_no_effect()` - Boundary test
- `test_can_move_image_down()` - PATCH /api/{resource}/{id}/move-down
- `test_move_down_at_bottom_has_no_effect()` - Boundary test
- `test_can_tighten_ordering()` - POST /api/{resource}/tighten-ordering
- `test_move_operations_return_404_for_nonexistent_image()` - 404 handling

**Required methods to implement:**
```php
abstract protected function getResourceName(): string;
abstract protected function getModelClass(): string;
```

**Usage:**
```php
use Tests\Api\Traits\TestsApiImageResource;
use Tests\Api\Traits\TestsApiImageViewing;

class ItemImageTest extends TestCase
{
    use TestsApiImageResource;   // CRUD + ordering
    use TestsApiImageViewing {   // Download + view
        TestsApiImageResource::getFactoryData insteadof TestsApiImageViewing;
        TestsApiImageResource::hasColumn insteadof TestsApiImageViewing;
    }
    
    protected function getResourceName(): string { return 'items.images'; }
    protected function getModelClass(): string { return ItemImage::class; }
    protected function getFactoryData(): array { return ['item_id' => Item::factory()]; }
}
```

---

### TestsApiImageViewing.php
**Purpose:** Download and view operations for image resources

**Provides 6 test methods:**
1. `test_can_download_image()` - GET /api/{resource}/{id}/download
2. `test_download_returns_404_for_nonexistent_image()`
3. `test_download_returns_404_when_file_missing()`
4. `test_can_view_image()` - GET /api/{resource}/{id}/view
5. `test_view_returns_404_for_nonexistent_image()`
6. `test_view_returns_404_when_file_missing()`

**Required methods to implement:**
```php
abstract protected function getResourceName(): string;
abstract protected function getModelClass(): string;
```

**Usage:** Always paired with `TestsApiImageResource` (see above)

**When to use:** Image resources (ItemImage, CollectionImage, PartnerImage, etc.) and AvailableImage

---

## Trait Conflict Resolution

When using multiple traits that have overlapping methods, use conflict resolution:

```php
use TestsApiImageResource;
use TestsApiImageViewing {
    TestsApiImageResource::getFactoryData insteadof TestsApiImageViewing;
    TestsApiImageResource::hasColumn insteadof TestsApiImageViewing;
}
```

## Creating New Traits

When creating a new trait for common patterns:

1. **Identify the pattern** - Find repetitive test code across 3+ test files
2. **Create abstract trait** - Make methods abstract where needed
3. **Document thoroughly** - What it provides, required methods, usage
4. **Use consistent naming** - `TestsApi{Feature}` format
5. **Keep focused** - One responsibility per trait
6. **Add to this README** - Document for future maintainers

## Best Practices

✅ **DO:**
- Use traits for common CRUD patterns
- Implement all required abstract methods
- Override trait methods when needed for special cases
- Combine multiple traits for complex resources
- Document trait usage in test classes

❌ **DON'T:**
- Mix different authentication mechanisms in traits
- Create traits for single-use patterns
- Override trait test methods without good reason
- Forget to resolve trait conflicts
- Test framework features (Laravel already does this)
