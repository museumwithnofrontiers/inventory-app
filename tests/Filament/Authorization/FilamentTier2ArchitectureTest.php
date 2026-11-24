<?php

namespace Tests\Filament\Authorization;

use RecursiveIteratorIterator;
use RecursiveDirectoryIterator;
use Filament\Pages\Page;
use Filament\Resources\Resource;
use Filament\Widgets\Widget;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionClass;
use Tests\TestCase;

/**
 * Architectural test: every Filament resource, custom page, and top-level widget must
 * declare its own Tier 2 visibility boundary method rather than falling through to the
 * Filament base-class default (which allows any authenticated panel user through).
 *
 * Resources  → must declare canViewAny() in their own class
 * Pages      → must declare canAccess() in their own class
 * Widgets    → must declare canView() in their own class
 */
class FilamentTier2ArchitectureTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string> */
    private function discoverResources(): array
    {
        return $this->discoverClasses(app_path('Filament/Resources'), 'App\\Filament\\Resources', Resource::class);
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
     * Check that a method is declared directly in the given class (not only inherited
     * from a Filament base class).
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

    public function test_every_resource_declares_can_view_any(): void
    {
        $failures = [];

        foreach ($this->discoverResources() as $resource) {
            if (! $this->declaresOwnMethod($resource, 'canViewAny')) {
                $failures[] = $resource;
            }
        }

        $this->assertEmpty(
            $failures,
            "The following Filament resources do not declare an explicit canViewAny() Tier 2 boundary:\n"
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
}
