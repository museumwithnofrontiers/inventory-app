<?php

namespace Tests\Filament\Concerns;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * M7 Story A0.4: guards against a new local copy of the shared admin-panel
 * test helpers creeping back in anywhere under tests/. The only allowed
 * definitions of these four methods are the ones on this trait.
 */
class InteractsWithAdminPanelTest extends TestCase
{
    private const GUARDED_METHODS = [
        'setCurrentPanel',
        'createCrudUser',
        'createReferenceDataUser',
        'createViewOnlyUser',
    ];

    private const ALLOWED_FILE = 'tests/Filament/Concerns/InteractsWithAdminPanel.php';

    public function test_no_local_copy_of_the_shared_admin_panel_helpers_exists_outside_the_trait(): void
    {
        $offenders = [];

        foreach ($this->phpFilesUnderTests() as $path) {
            $relative = $this->relativePath($path);

            if ($relative === self::ALLOWED_FILE) {
                continue;
            }

            $contents = file_get_contents($path);

            foreach (self::GUARDED_METHODS as $method) {
                if (preg_match('/function\s+'.preg_quote($method, '/').'\s*\(/', $contents) === 1) {
                    $offenders[] = "{$relative} defines {$method}()";
                }
            }
        }

        $this->assertSame([], $offenders, "Local copies of shared admin-panel helpers found outside the trait:\n".implode("\n", $offenders));
    }

    /**
     * @return list<string>
     */
    private function phpFilesUnderTests(): array
    {
        $root = dirname(__DIR__, 2);
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        $files = [];

        /** @var SplFileInfo $file */
        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = $file->getPathname();
            }
        }

        sort($files);

        return $files;
    }

    private function relativePath(string $path): string
    {
        $root = dirname(__DIR__, 3);
        $normalized = str_replace('\\', '/', $path);
        $normalizedRoot = str_replace('\\', '/', $root);

        return ltrim(str_replace($normalizedRoot, '', $normalized), '/');
    }
}
