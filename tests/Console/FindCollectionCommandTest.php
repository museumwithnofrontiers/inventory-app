<?php

namespace Tests\Console;

use App\Models\Collection;
use App\Models\CollectionTranslation;
use App\Models\Context;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class FindCollectionCommandTest extends TestCase
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
        ?string $parentId = null,
        ?string $slug = null
    ): Collection {
        $collection = Collection::factory()->create([
            'type' => $type,
            'backward_compatibility' => $backwardCompatibility,
            'internal_name' => $internalName,
            'language_id' => $this->english->id,
            'context_id' => $this->defaultContext->id,
            'parent_id' => $parentId,
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
        $this->artisan('importer:find-collection', ['kind' => 'theme', 'selector' => '1'])
            ->assertExitCode(1)
            ->expectsOutputToContain("Invalid kind 'theme'");
    }

    public function test_resolves_a_gallery_by_legacy_numeric_id(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Carpets'
        );

        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => '9'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_resolves_a_gallery_by_exact_english_title(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Carpets'
        );

        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => 'Carpets'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_title_match_is_case_sensitive(): void
    {
        $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Carpets'
        );

        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => 'carpets'])
            ->assertExitCode(1)
            ->expectsOutputToContain('No gallery collection found');
    }

    public function test_resolves_a_thg_exhibition_by_legacy_numeric_id(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_EXHIBITION,
            'mwnf3_thematic_gallery:thg_gallery:47',
            'exhibition_the_use_of_colours_in_art',
            'The Use of Colours in Art'
        );

        $this->artisan('importer:find-collection', ['kind' => 'exhibition', 'selector' => '47'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_resolves_a_sharing_history_exhibition_by_legacy_numeric_id(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_EXHIBITION,
            'mwnf3_sharing_history:sh_exhibitions:1',
            'exhibition_sh_1',
            'A Sharing History Exhibition'
        );

        $this->artisan('importer:find-collection', ['kind' => 'exhibition', 'selector' => '1'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_a_gallery_backward_compatibility_pattern_does_not_leak_into_exhibition_lookups(): void
    {
        // Legacy gallery_id 9 is a gallery, not an exhibition — searching by
        // kind=exhibition must not find it even though the numeric id matches
        // the same legacy table.
        $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Carpets'
        );

        $this->artisan('importer:find-collection', ['kind' => 'exhibition', 'selector' => '9'])
            ->assertExitCode(1)
            ->expectsOutputToContain('No exhibition collection found');
    }

    public function test_resolves_an_mwnf3_project_by_legacy_key(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_COLLECTION,
            'mwnf3:projects:ISL',
            'Discover Islamic Art',
            'Discover Islamic Art'
        );

        $this->artisan('importer:find-collection', ['kind' => 'project', 'selector' => 'ISL'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_resolves_a_sharing_history_project_by_legacy_key(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_COLLECTION,
            'mwnf3_sharing_history:sh_projects:awe',
            'A World of Sharing History',
            'A World of Sharing History'
        );

        $this->artisan('importer:find-collection', ['kind' => 'project', 'selector' => 'awe'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_resolves_a_project_by_exact_english_title_when_key_does_not_match(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_COLLECTION,
            'mwnf3:projects:ISL',
            'Discover Islamic Art',
            'Discover Islamic Art'
        );

        $this->artisan('importer:find-collection', ['kind' => 'project', 'selector' => 'Discover Islamic Art'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_a_project_type_collection_unrelated_to_any_project_root_is_not_matched(): void
    {
        // type=collection is shared by unrelated root/anchor collections
        // (galleries-root, artintro-root, ...) — none of those must satisfy a
        // kind=project lookup just because the type matches.
        $this->createCollectionWithTitle(
            Collection::TYPE_COLLECTION,
            'mwnf3_thematic_gallery:galleries_root',
            'thg_galleries_root',
            'Galleries'
        );

        $this->artisan('importer:find-collection', ['kind' => 'project', 'selector' => 'Galleries'])
            ->assertExitCode(1)
            ->expectsOutputToContain('No project collection found');
    }

    public function test_reports_zero_matches(): void
    {
        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => '999'])
            ->assertExitCode(1)
            ->expectsOutputToContain("No gallery collection found for selector '999'");
    }

    public function test_reports_ambiguous_matches_and_lists_candidates(): void
    {
        $first = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Duplicate Title'
        );
        $second = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:10',
            'gallery_amulets',
            'Duplicate Title'
        );

        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => 'Duplicate Title'])
            ->assertExitCode(1)
            ->expectsOutputToContain('Ambiguous')
            ->expectsOutputToContain($first->id)
            ->expectsOutputToContain($second->id);
    }

    public function test_outputs_parent_titles_and_backward_compatibility_as_json(): void
    {
        $root = $this->createCollectionWithTitle(
            Collection::TYPE_COLLECTION,
            'mwnf3_thematic_gallery:galleries_root',
            'thg_galleries_root',
            'Galleries'
        );
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Carpets',
            $root->id
        );

        // A single Symfony console write call carries this entire JSON blob, so
        // chaining multiple expectsOutputToContain() calls against it is
        // unreliable (each one is backed by its own Mockery expectation on the
        // same underlying write, and only one gets credited per call). Capture
        // the real output once instead and assert its decoded structure.
        $exitCode = Artisan::call('importer:find-collection', ['kind' => 'gallery', 'selector' => '9', '--json' => true]);
        $payload = json_decode(Artisan::output(), true);

        $this->assertSame(0, $exitCode);
        $this->assertIsArray($payload);
        $this->assertSame($collection->id, $payload['id']);
        $this->assertSame('gallery_carpets', $payload['internal_name']);
        $this->assertSame('gallery', $payload['type']);
        $this->assertSame($root->id, $payload['parent_id']);
        $this->assertSame('thg_galleries_root', $payload['parent_internal_name']);
        $this->assertSame('mwnf3_thematic_gallery:thg_gallery:9', $payload['backward_compatibility']);
        $this->assertSame(['eng' => 'Carpets'], $payload['titles']);
    }

    public function test_resolves_a_gallery_by_legacy_slug(): void
    {
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Carpets',
            null,
            'carpets'
        );

        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => 'carpets'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_resolves_an_exhibition_by_a_hyphenated_legacy_slug(): void
    {
        // The legacy slug and the further-slugified internal_name diverge
        // whenever the slug itself contains a hyphen — the raw slug
        // ("the-use-of-colours-in-art") must be matched verbatim, not the
        // underscored internal_name form.
        $collection = $this->createCollectionWithTitle(
            Collection::TYPE_EXHIBITION,
            'mwnf3_thematic_gallery:thg_gallery:47',
            'exhibition_the_use_of_colours_in_art',
            'The Use of Colours in Art',
            null,
            'the-use-of-colours-in-art'
        );

        $this->artisan('importer:find-collection', ['kind' => 'exhibition', 'selector' => 'the-use-of-colours-in-art'])
            ->assertExitCode(0)
            ->expectsOutputToContain($collection->id);
    }

    public function test_slug_match_is_case_sensitive(): void
    {
        // Title deliberately differs from the slug so this isolates slug
        // case-sensitivity rather than incidentally matching by title.
        $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_carpets',
            'Handwoven Carpets',
            null,
            'carpets'
        );

        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => 'CARPETS'])
            ->assertExitCode(1)
            ->expectsOutputToContain('No gallery collection found');
    }

    public function test_slug_does_not_leak_across_kinds(): void
    {
        // A gallery and an unrelated exhibition happen to share the same
        // legacy slug value — type-scoping (baseQuery()) must keep a
        // kind=gallery slug lookup from matching the exhibition, and vice
        // versa, so this must resolve cleanly rather than report ambiguity.
        $gallery = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_shared_slug',
            'Carpets',
            null,
            'shared-slug'
        );
        $this->createCollectionWithTitle(
            Collection::TYPE_EXHIBITION,
            'mwnf3_thematic_gallery:thg_gallery:47',
            'exhibition_shared_slug',
            'Colours',
            null,
            'shared-slug'
        );

        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => 'shared-slug'])
            ->assertExitCode(0)
            ->expectsOutputToContain($gallery->id);
    }

    public function test_reports_ambiguity_when_a_selector_matches_two_collections_via_different_forms(): void
    {
        // Selector "9" is gallery_a's legacy numeric id AND, independently,
        // gallery_b's legacy slug — the union-based resolution (numeric id +
        // slug + title, merged, deduplicated by collection) must treat this
        // as genuinely ambiguous rather than only trying the numeric form.
        $byId = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:9',
            'gallery_by_id',
            'Carpets'
        );
        $bySlug = $this->createCollectionWithTitle(
            Collection::TYPE_GALLERY,
            'mwnf3_thematic_gallery:thg_gallery:4',
            'gallery_by_slug',
            'Amulets',
            null,
            '9'
        );

        $this->artisan('importer:find-collection', ['kind' => 'gallery', 'selector' => '9'])
            ->assertExitCode(1)
            ->expectsOutputToContain('Ambiguous')
            ->expectsOutputToContain($byId->id)
            ->expectsOutputToContain($bySlug->id);
    }
}
