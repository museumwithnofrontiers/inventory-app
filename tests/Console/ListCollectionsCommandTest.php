<?php

namespace Tests\Console;

use App\Models\Collection;
use App\Models\CollectionTranslation;
use App\Models\Context;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class ListCollectionsCommandTest extends TestCase
{
    use RefreshDatabase;

    private Language $english;

    private Context $defaultContext;

    protected function setUp(): void
    {
        parent::setUp();

        $this->english = Language::factory()->create(['id' => 'eng']);
        $this->defaultContext = Context::factory()->default()->create();
    }

    private function createCollectionWithTitle(
        string $type,
        ?string $backwardCompatibility,
        string $internalName,
        string $title,
        ?string $slug = null
    ): Collection {
        $collection = Collection::factory()->create([
            'type' => $type,
            'backward_compatibility' => $backwardCompatibility,
            'internal_name' => $internalName,
            'language_id' => $this->english->id,
            'context_id' => $this->defaultContext->id,
            'parent_id' => null,
            'extra' => $slug !== null ? ['thg_gallery' => ['slug' => $slug]] : null,
        ]);

        CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $this->english->id,
            'context_id' => $this->defaultContext->id,
            'title' => $title,
            'backward_compatibility' => null,
        ]);

        return $collection;
    }

    public function test_rejects_an_invalid_kind(): void
    {
        $this->artisan('importer:list-collections', ['kind' => 'theme'])
            ->assertExitCode(1)
            ->expectsOutputToContain("Invalid kind 'theme'");
    }

    public function test_reports_when_no_collections_of_a_kind_exist(): void
    {
        $this->artisan('importer:list-collections', ['kind' => 'gallery'])
            ->assertExitCode(0)
            ->expectsOutputToContain('No gallery collections found');
    }

    public function test_lists_every_gallery_with_its_selectors(): void
    {
        $this->createCollectionWithTitle(Collection::TYPE_GALLERY, 'mwnf3_thematic_gallery:thg_gallery:9', 'gallery_carpets', 'Carpets');
        $this->createCollectionWithTitle(Collection::TYPE_GALLERY, 'mwnf3_thematic_gallery:thg_gallery:4', 'gallery_amulets', 'Amulets');

        // A table row writes multiple columns through a single console write
        // call, so several expectsOutputToContain() assertions against
        // substrings on the same row are unreliable (see the --json tests
        // below for the full explanation). Capture the real output once and
        // assert against that string directly instead.
        $exitCode = Artisan::call('importer:list-collections', ['kind' => 'gallery']);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('Carpets', $output);
        $this->assertStringContainsString('Amulets', $output);
        $this->assertStringContainsString('gallery_carpets', $output);
        $this->assertStringContainsString('gallery_amulets', $output);
    }

    public function test_excludes_collections_of_other_types_and_unrelated_project_roots(): void
    {
        $this->createCollectionWithTitle(Collection::TYPE_GALLERY, 'mwnf3_thematic_gallery:thg_gallery:9', 'gallery_carpets', 'Carpets');
        $this->createCollectionWithTitle(Collection::TYPE_COLLECTION, 'mwnf3_thematic_gallery:galleries_root', 'thg_galleries_root', 'Galleries');
        $this->createCollectionWithTitle(Collection::TYPE_EXHIBITION, 'mwnf3_thematic_gallery:thg_gallery:47', 'exhibition_colours', 'Colours');

        $this->artisan('importer:list-collections', ['kind' => 'gallery'])
            ->assertExitCode(0)
            ->expectsOutputToContain('Carpets')
            ->doesntExpectOutputToContain('Galleries')
            ->doesntExpectOutputToContain('Colours');
    }

    public function test_lists_only_recognised_project_roots_when_kind_is_project(): void
    {
        $this->createCollectionWithTitle(Collection::TYPE_COLLECTION, 'mwnf3:projects:ISL', 'Discover Islamic Art', 'Discover Islamic Art');
        $this->createCollectionWithTitle(Collection::TYPE_COLLECTION, 'mwnf3_sharing_history:sh_projects:awe', 'A World of Sharing History', 'A World of Sharing History');
        $this->createCollectionWithTitle(Collection::TYPE_COLLECTION, 'mwnf3_thematic_gallery:galleries_root', 'thg_galleries_root', 'Galleries');

        $this->artisan('importer:list-collections', ['kind' => 'project'])
            ->assertExitCode(0)
            ->expectsOutputToContain('Discover Islamic Art')
            ->expectsOutputToContain('A World of Sharing History')
            ->doesntExpectOutputToContain('Galleries');
    }

    public function test_outputs_legacy_selector_slug_title_uuid_and_internal_name_as_json(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Carpets',
            'carpets'
        );

        // See the note on test_lists_every_gallery_with_its_selectors(): a
        // single write call backs this whole JSON blob, so multiple chained
        // expectsOutputToContain() assertions against it are unreliable.
        // Decode the real output once and assert its structure instead.
        $exitCode = Artisan::call('importer:list-collections', ['kind' => 'gallery', '--json' => true]);
        $rows = json_decode(Artisan::output(), true);

        $this->assertSame(0, $exitCode);
        $this->assertIsArray($rows);
        $this->assertCount(1, $rows);
        $this->assertSame('9', $rows[0]['legacy_selector']);
        $this->assertSame('carpets', $rows[0]['slug']);
        $this->assertSame('Carpets', $rows[0]['english_title']);
        $this->assertSame($collection->id, $rows[0]['id']);
        $this->assertSame('gallery_carpets', $rows[0]['internal_name']);
    }

    public function test_lists_a_collection_with_no_recognised_backward_compatibility_prefix_with_a_null_selector(): void
    {
        // Should not happen for real importer data (every gallery/exhibition
        // carries the thg_gallery pattern), but the command must not crash on
        // one that, for whatever reason, doesn't.
        $this->createCollectionWithTitle(Collection::TYPE_GALLERY, null, 'gallery_orphan', 'Orphan Gallery');

        $exitCode = Artisan::call('importer:list-collections', ['kind' => 'gallery', '--json' => true]);
        $rows = json_decode(Artisan::output(), true);

        $this->assertSame(0, $exitCode);
        $this->assertIsArray($rows);
        $this->assertCount(1, $rows);
        $this->assertNull($rows[0]['legacy_selector']);
        $this->assertNull($rows[0]['slug']);
        $this->assertSame('Orphan Gallery', $rows[0]['english_title']);
    }

    public function test_shows_the_legacy_slug_in_the_table_listing(): void
    {
        $this->createCollectionWithTitle(
            Collection::TYPE_EXHIBITION,
            'mwnf3_thematic_gallery:thg_gallery:47',
            'exhibition_the_use_of_colours_in_art',
            'The Use of Colours in Art',
            'the-use-of-colours-in-art'
        );

        $exitCode = Artisan::call('importer:list-collections', ['kind' => 'exhibition']);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('Slug', $output);
        $this->assertStringContainsString('the-use-of-colours-in-art', $output);
    }
}
