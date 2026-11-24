<?php

namespace Tests\Filament\Authorization;

use App\Enums\Role;
use App\Filament\Pages\BrowseCollectionTree;
use App\Filament\Pages\BrowseItemTree;
use App\Filament\Pages\BrowseTimelineTree;
use App\Filament\Pages\PendingRegistrationsPage;
use App\Filament\Pages\SelfRegistrationSettingsPage;
use App\Filament\Resources\PublicationEditionResource;
use App\Models\User;
use Filament\Facades\Filament;
use Filament\Pages\Page;
use Filament\Resources\Pages\ManageRelatedRecords;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Resources\Resource;
use Filament\Widgets\Widget;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use ReflectionClass;
use Tests\TestCase;

/**
 * Tier 2 in the panel: every Filament resource, custom page and top-level
 * widget declares its own visibility boundary rather than falling through to
 * the Filament base-class default.
 *
 * Resources  → declare getViewAnyAuthorizationResponse() (the model's viewAny
 *              policy) and shouldRegisterNavigation()
 * Pages      → declare canAccess()
 * Widgets    → declare canView()
 *
 * Filament 4 reads a resource's and a relation manager's authorization from
 * its get*AuthorizationResponse() methods and no longer calls most can*()
 * overrides, so none may be declared: a can*() override would look like a
 * boundary and enforce nothing.
 */
class FilamentTier2ArchitectureTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The can*() methods Filament derives from a get*AuthorizationResponse().
     * A relation manager's static canViewForRecord() is not one of them: it
     * is still the boundary Filament asks before showing the manager.
     */
    private const DERIVED_CAN_METHODS = [
        'canViewAny', 'canView', 'canCreate', 'canEdit', 'canDelete', 'canDeleteAny',
        'canForceDelete', 'canForceDeleteAny', 'canRestore', 'canRestoreAny',
        'canReplicate', 'canReorder', 'canAttach', 'canDetach', 'canDetachAny',
        'canAssociate', 'canDissociate', 'canDissociateAny',
    ];

    /** @return array<class-string<resource>> */
    private function discoverResources(): array
    {
        /** @var array<class-string<resource>> */
        return $this->discoverClasses(app_path('Filament/Resources'), 'App\\Filament\\Resources', Resource::class);
    }

    /** @return array<string> */
    private function discoverRelationManagers(): array
    {
        return [
            ...$this->discoverClasses(app_path('Filament/Resources'), 'App\\Filament\\Resources', RelationManager::class),
            ...$this->discoverClasses(app_path('Filament/Resources'), 'App\\Filament\\Resources', ManageRelatedRecords::class),
        ];
    }

    /** @return array<string> */
    private function discoverPages(): array
    {
        // Only top-level custom pages (not sub-pages registered under a resource).
        return $this->discoverClasses(app_path('Filament/Pages'), 'App\\Filament\\Pages', Page::class);
    }

    /** @return array<string> */
    private function discoverWidgets(): array
    {
        // Only top-level widgets in app/Filament/Widgets (not resource-scoped nested widgets).
        return $this->discoverClasses(app_path('Filament/Widgets'), 'App\\Filament\\Widgets', Widget::class);
    }

    /**
     * Find all concrete classes in a directory that extend the given base class.
     *
     * @return array<string>
     */
    private function discoverClasses(string $directory, string $namespace, string $baseClass): array
    {
        if (! is_dir($directory)) {
            return [];
        }

        $classes = [];

        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory)) as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }

            // Derive the class name from the file path.
            $relativePath = str_replace([$directory.'/', $directory.'\\'], '', $file->getPathname());
            $relativePath = str_replace(['/', '\\'], '\\', $relativePath);
            $className = $namespace.'\\'.str_replace('.php', '', $relativePath);

            if (! class_exists($className)) {
                continue;
            }

            $reflection = new ReflectionClass($className);

            if ($reflection->isAbstract() || $reflection->isInterface() || $reflection->isTrait()) {
                continue;
            }

            if (! $reflection->isSubclassOf($baseClass)) {
                continue;
            }

            $classes[] = $className;
        }

        return $classes;
    }

    /**
     * Check that a method is declared directly in the given class, or by a
     * trait it uses (not only inherited from a base class).
     */
    private function declaresOwnMethod(string $className, string $methodName): bool
    {
        $reflection = new ReflectionClass($className);

        if (! $reflection->hasMethod($methodName)) {
            return false;
        }

        $declaringClass = $reflection->getMethod($methodName)->getDeclaringClass()->getName();

        return $declaringClass === $className;
    }

    /**
     * Whether any class between $className and Filament's own classes
     * declares the method (an app base class or trait counts).
     */
    private function appDeclaresMethod(string $className, string $methodName): bool
    {
        $reflection = new ReflectionClass($className);

        if (! $reflection->hasMethod($methodName)) {
            return false;
        }

        return str_starts_with($reflection->getMethod($methodName)->getDeclaringClass()->getName(), 'App\\');
    }

    public function test_every_resource_declares_its_view_any_authorization_response(): void
    {
        $failures = [];

        foreach ($this->discoverResources() as $resource) {
            if (! $this->declaresOwnMethod($resource, 'getViewAnyAuthorizationResponse')) {
                $failures[] = $resource;
            }
        }

        $this->assertNotEmpty($this->discoverResources());
        $this->assertEmpty(
            $failures,
            "The following Filament resources do not declare an explicit getViewAnyAuthorizationResponse() Tier 2 boundary:\n"
            .implode("\n", $failures)
        );
    }

    public function test_every_resource_declares_should_register_navigation(): void
    {
        $failures = [];

        foreach ($this->discoverResources() as $resource) {
            if (! $this->declaresOwnMethod($resource, 'shouldRegisterNavigation')) {
                $failures[] = $resource;
            }
        }

        $this->assertEmpty(
            $failures,
            "The following Filament resources do not declare an explicit shouldRegisterNavigation() method:\n"
            .implode("\n", $failures)
        );
    }

    public function test_no_resource_or_relation_manager_overrides_a_can_method(): void
    {
        $classes = [...$this->discoverResources(), ...$this->discoverRelationManagers()];
        $failures = [];

        foreach ($classes as $class) {
            foreach (self::DERIVED_CAN_METHODS as $method) {
                if ($this->appDeclaresMethod($class, $method)) {
                    $failures[] = "{$class}::{$method}()";
                }
            }
        }

        $this->assertNotEmpty($this->discoverRelationManagers());
        $this->assertEmpty(
            $failures,
            "Filament 4 ignores these can*() overrides; move them to the matching get*AuthorizationResponse() method:\n"
            .implode("\n", $failures)
        );
    }

    public function test_every_page_declares_can_access(): void
    {
        $failures = [];

        foreach ($this->discoverPages() as $page) {
            if (! $this->declaresOwnMethod($page, 'canAccess')) {
                $failures[] = $page;
            }
        }

        $this->assertEmpty(
            $failures,
            "The following Filament pages do not declare an explicit canAccess() Tier 2 boundary:\n"
            .implode("\n", $failures)
        );
    }

    public function test_every_top_level_widget_declares_can_view(): void
    {
        $failures = [];

        foreach ($this->discoverWidgets() as $widget) {
            if (! $this->declaresOwnMethod($widget, 'canView')) {
                $failures[] = $widget;
            }
        }

        $this->assertEmpty(
            $failures,
            "The following Filament widgets do not declare an explicit canView() Tier 2 boundary:\n"
            .implode("\n", $failures)
        );
    }

    /**
     * @return array<string, array{0: ?Role}>
     */
    public static function roles(): array
    {
        return [
            'no role' => [null],
            'Visitor' => [Role::VISITOR],
            'Manager of Data' => [Role::DATA_MANAGER],
            'Manager of Users' => [Role::USER_MANAGER],
            'Superadmin' => [Role::SUPERADMIN],
        ];
    }

    private function signIn(?Role $role): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        if ($role !== null) {
            $user->assignRole($role->value);
        }

        $this->actingAs($user);
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        return $user;
    }

    /**
     * A resource is visible, reachable and listed exactly when the model's
     * viewAny policy allows it, as it was on Filament 3.
     */
    #[DataProvider('roles')]
    public function test_resource_visibility_follows_the_view_any_policy(?Role $role): void
    {
        $user = $this->signIn($role);

        foreach ($this->discoverResources() as $resource) {
            $allowed = $user->can('viewAny', $resource::getModel());

            $this->assertSame($allowed, $resource::getViewAnyAuthorizationResponse()->allowed(), "{$resource} viewAny response");
            $this->assertSame($allowed, $resource::canViewAny(), "{$resource}::canViewAny()");
            $this->assertSame($allowed, $resource::canAccess(), "{$resource}::canAccess()");
            $this->assertSame(
                $resource === PublicationEditionResource::class ? false : $allowed,
                $resource::shouldRegisterNavigation(),
                "{$resource}::shouldRegisterNavigation()",
            );
        }
    }

    #[DataProvider('roles')]
    public function test_resource_list_pages_answer_forbidden_without_view_any(?Role $role): void
    {
        $user = $this->signIn($role);
        $panelAccess = $role !== null;

        foreach ($this->discoverResources() as $resource) {
            if (! $resource::hasPage('index')) {
                continue;
            }

            $response = $this->get($resource::getUrl('index'));

            if (! $panelAccess || ! $user->can('viewAny', $resource::getModel())) {
                $response->assertForbidden();
            } else {
                $response->assertOk();
            }
        }
    }

    /**
     * Filament still honours a page's canAccess(): a page it denies answers
     * 403 and is left out of the navigation.
     */
    #[DataProvider('roles')]
    public function test_custom_pages_honour_can_access(?Role $role): void
    {
        $this->signIn($role);
        $panelAccess = $role !== null;

        $pages = [
            BrowseCollectionTree::class,
            BrowseItemTree::class,
            BrowseTimelineTree::class,
            PendingRegistrationsPage::class,
            SelfRegistrationSettingsPage::class,
        ];

        foreach ($pages as $page) {
            $response = $this->get($page::getUrl());

            if ($panelAccess && $page::canAccess()) {
                $response->assertOk();
                $this->assertTrue($page::shouldRegisterNavigation(), "{$page} in the navigation");
            } else {
                $response->assertForbidden();
                $this->assertFalse($page::shouldRegisterNavigation(), "{$page} in the navigation");
            }
        }
    }
}
