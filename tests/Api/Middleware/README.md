# API Middleware Tests

## Purpose

These tests verify that **ALL** API routes are properly protected by authentication and authorization middleware. They complement the resource-specific tests by ensuring security is enforced at the middleware layer.

## Test Files

### AuthorizationMiddlewareTest.php
**Verifies:** the `permission` and `role` middleware themselves (`RequirePermission`, `RequireRole`), on routes the test registers: a guest is turned away, a user without the permission or role is refused, a user with it gets through.

### AuthenticationTest.php
**Verifies:** Every API route rejects unauthenticated requests with 401 Unauthorized

**Test Structure:**
```php
/**
 * @dataProvider protectedRoutesProvider
 */
public function test_route_requires_authentication(string $method, string $route, ?string $model = null): void
{
    // Attempt request without auth token
    $response = $this->{strtolower($method)}Json(route($route, $this->getRouteParams($model)));
    
    // Should be rejected
    $response->assertUnauthorized(); // 401
}
```

**Data Provider:**
- Lists ALL API routes systematically
- Grouped by HTTP method (GET index/show, POST store, PUT update, DELETE destroy, PATCH special)
- Each route includes model class if it requires a resource parameter

### PermissionsTest.php
**Verifies:** Every API route enforces the correct permission

**Test Structure:**
```php
/**
 * @dataProvider routePermissionsProvider
 */
public function test_route_enforces_correct_permission(
    string $method,
    string $route,
    string $permission,
    ?string $model = null
): void
{
    // Create user WITHOUT the required permission
    $user = User::factory()->create();
    // Explicitly NOT giving the required permission
    
    Sanctum::actingAs($user);
    
    $response = $this->{strtolower($method)}Json(route($route, $this->getRouteParams($model)));
    
    // Should be forbidden
    $response->assertForbidden(); // 403
    
    // Now give the permission
    $user->givePermissionTo($permission);
    app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    
    $response = $this->{strtolower($method)}Json(route($route, $this->getRouteParams($model)));
    
    // Should now be allowed (may still fail validation, but not 403)
    $response->assertStatus(fn($status) => $status !== 403);
}
```

**Data Provider:**
- Maps each route to its required permission
- index/show routes → VIEW_DATA
- store routes → CREATE_DATA  
- update routes → UPDATE_DATA
- destroy routes → DELETE_DATA
- Special routes (setDefault, etc.) → UPDATE_DATA

## Key Differences from Resource Tests

| Aspect | Resource Tests (Api/Resources/) | Middleware Tests (Api/Middleware/) |
|--------|--------------------------------|-----------------------------------|
| **Focus** | Business logic, data validation, responses | Security enforcement |
| **Auth** | Authenticated user with ALL permissions | Various permission combinations |
| **Scope** | One resource at a time | ALL routes systematically |
| **Assertions** | Response structure, data accuracy | HTTP status codes (401, 403) |
| **Coverage** | Deep testing of one endpoint | Broad testing of all endpoints |

## Maintenance

**When adding a new API route:**
1. Add route to `AuthenticationTest::protectedRoutesProvider()`
2. Add route + permission to `PermissionsTest::routePermissionsProvider()`
3. Run middleware tests to verify security is enforced
4. Create resource-specific tests for business logic

**Benefits:**
- Single point of truth for route security
- Easy to spot missing middleware
- Catches copy-paste errors in controller middleware
- Documents permission requirements
