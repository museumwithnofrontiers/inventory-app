<?php

namespace Tests\Console;

use App\Models\AvailableImage;
use App\Models\Item;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * `docs:models` reads the models; it must never write to the database. It
 * once called every public method without parameters on a blank model, which
 * renumbered every root item's display_order (HasDisplayOrder::
 * tightenOrdering()) and created empty AvailableImages
 * (detachToAvailableImage()).
 */
class GenerateModelDocumentationTest extends TestCase
{
    use RefreshDatabase;

    private string $docsPath;

    private ?string $original = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->docsPath = base_path('docs/_model/index.md');
        $this->original = File::exists($this->docsPath) ? File::get($this->docsPath) : null;
    }

    protected function tearDown(): void
    {
        if ($this->original !== null) {
            File::put($this->docsPath, $this->original);
        }
        parent::tearDown();
    }

    public function test_it_writes_nothing_to_the_database(): void
    {
        $first = Item::factory()->Object()->create(['display_order' => 10]);
        $second = Item::factory()->Object()->create(['display_order' => 30]);
        $images = AvailableImage::count();

        $this->artisan('docs:models', ['--force' => true])->assertSuccessful();

        $this->assertSame(10, $first->fresh()?->display_order);
        $this->assertSame(30, $second->fresh()?->display_order);
        $this->assertSame($images, AvailableImage::count());
    }

    public function test_it_still_documents_the_relations(): void
    {
        $this->artisan('docs:models', ['--force' => true])->assertSuccessful();

        $docs = File::get($this->docsPath);
        $this->assertStringContainsString('translations', $docs);
        $this->assertStringContainsString('ItemTranslation', $docs);
    }
}
