<?php

namespace Tests\Configuration;

use Filament\Resources\Resource;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class FilamentConventionsTest extends TestCase
{
    public function test_resources_follow_the_filament_naming_conventions(): void
    {
        $resourceFiles = File::allFiles(app_path('Filament/Resources'));
        $violations = [];

        foreach ($resourceFiles as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            $relativePath = str_replace('\\', '/', $file->getRelativePathname());

            if (! str_ends_with($relativePath, 'Resource.php')) {
                continue;
            }

            $class = 'App\\Filament\\Resources\\'.str_replace(['/', '.php'], ['\\', ''], $relativePath);

            if (! is_subclass_of($class, Resource::class)) {
                continue;
            }

            $entity = str($file->getFilenameWithoutExtension())->beforeLast('Resource')->toString();
            $pagesPath = app_path("Filament/Resources/{$entity}Resource/Pages");
            $relationManagersPath = app_path("Filament/Resources/{$entity}Resource/RelationManagers");

            if (File::isDirectory($pagesPath)) {
                foreach (File::files($pagesPath) as $pageFile) {
                    if (! preg_match('/^(List|Create|Edit|View)'.preg_quote($entity, '/').'\\.php$/', $pageFile->getFilename())) {
                        $violations[] = 'Invalid Filament page class name: app/Filament/Resources/'
                            .$entity.'Resource/Pages/'.$pageFile->getFilename();
                    }
                }
            }

            if (File::isDirectory($relationManagersPath)) {
                foreach (File::files($relationManagersPath) as $relationManagerFile) {
                    if (! preg_match('/^[A-Z]\\w+RelationManager\\.php$/', $relationManagerFile->getFilename())) {
                        $violations[] = 'Invalid relation manager class name: app/Filament/Resources/'
                            .$entity.'Resource/RelationManagers/'.$relationManagerFile->getFilename();
                    }
                }
            }
        }

        $this->assertEmpty(
            $violations,
            "Filament naming convention violation(s) found:\n".implode("\n", $violations),
        );
    }

    public function test_filament_resources_do_not_define_custom_blade_views(): void
    {
        $filamentResourcesPath = app_path('Filament/Resources');
        $violations = [];

        foreach (File::allFiles($filamentResourcesPath) as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            foreach (explode("\n", $file->getContents()) as $lineNumber => $line) {
                if (preg_match('/\\$view\\s*=\\s*[\'"]/', $line)) {
                    $relativePath = str_replace(base_path().'/', '', str_replace('\\', '/', $file->getPathname()));
                    $violations[] = "{$relativePath}:".($lineNumber + 1)." — {$line}";
                }
            }
        }

        $this->assertEmpty(
            $violations,
            "Custom Filament resource Blade view(s) found:\n".implode("\n", $violations),
        );
    }

    public function test_filament_admin_vite_theme_builds_on_filaments_theme_and_scans_the_apps_sources(): void
    {
        $themePath = resource_path('css/filament/admin/theme.css');
        $themeCss = File::get($themePath);

        $this->assertStringContainsString(
            "@import '../../../../vendor/filament/filament/resources/css/theme.css';",
            $themeCss,
            "The Filament admin Vite theme must build on Filament's own theme, which loads Tailwind.",
        );

        $this->assertStringContainsString(
            "@source '../../../../app/**/*.php';",
            $themeCss,
            'The Filament admin Vite theme must scan the classes the PHP code names.',
        );

        $this->assertStringContainsString(
            "@source '../../../../resources/views/**/*.blade.php';",
            $themeCss,
            "The Filament admin Vite theme must scan the panel's own views.",
        );

        // Filament's theme brings its own classes; scanning its views again
        // is what its upgrade guide says not to do
        $this->assertStringNotContainsString("@source '../../../../vendor/filament", $themeCss);
    }
}
