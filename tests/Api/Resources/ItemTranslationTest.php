<?php

namespace Tests\Api\Resources;

use App\Enums\ItemTranslationStatus;
use App\Models\ItemTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class ItemTranslationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'item-translation';
    }

    protected function getModelClass(): string
    {
        return ItemTranslation::class;
    }

    /**
     * Override to exclude JSON fields that get double-encoded
     */
    public function test_can_create_resource(): void
    {
        $modelClass = $this->getModelClass();
        $data = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove id, timestamps, system-managed fields, and JSON fields
        $data = array_diff_key($data, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default', 'extra']));

        $response = $this->postJson(route($this->getResourceName().'.store'), $data);
        $response->assertCreated()
            ->assertJsonStructure(['data' => ['id']]);

        $this->assertDatabaseHas($modelClass::make()->getTable(),
            array_intersect_key($data, array_flip($modelClass::make()->getFillable()))
        );
    }

    /**
     * Override to exclude JSON fields that get double-encoded
     */
    public function test_can_update_resource(): void
    {
        $modelClass = $this->getModelClass();
        $resource = $modelClass::factory()->create($this->getFactoryData());
        $updateData = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove id, timestamps, system-managed fields, and JSON fields
        $updateData = array_diff_key($updateData, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default', 'extra']));

        $response = $this->putJson(route($this->getResourceName().'.update', $resource), $updateData);
        $response->assertOk()
            ->assertJsonPath('data.id', $resource->id);

        $this->assertDatabaseHas($modelClass::make()->getTable(),
            ['id' => $resource->id] + array_intersect_key($updateData, array_flip($modelClass::make()->getFillable()))
        );
    }

    /**
     * Legacy writes alternate names and types longer than 255 characters; both
     * are kept whole.
     */
    public function test_keeps_a_long_alternate_name_and_type_whole(): void
    {
        $resource = ItemTranslation::factory()->create();
        $long = rtrim(str_repeat('Wax statue of a man showing deep muscles; ', 10));

        $this->putJson(route('item-translation.update', $resource), [
            'alternate_name' => $long,
            'type' => $long,
        ])->assertOk();

        $resource->refresh();
        $this->assertSame($long, $resource->alternate_name);
        $this->assertSame($long, $resource->type);
    }

    /**
     * The display texts and credits that left `extra` (M16 B1 to B6) are
     * stored and served as written.
     */
    public function test_stores_and_serves_the_display_columns(): void
    {
        $resource = ItemTranslation::factory()->create();
        $texts = [
            'short_description' => 'A brass basin, engraved.',
            'materials' => 'Brass, hammered, engraved and inlaid with silver.',
            'dynasty' => 'Mamluk; the lid probably Ottoman.',
            'region' => 'Damascus',
            'history' => 'Built in 1277, restored in 1350.',
            'author_credit' => 'Mona al-Moadin - Zena Takieddine.',
            'copy_editor_credit' => 'Mandi Gomez.',
            'translator_credit' => 'Hilary Kalmbach (from the Arabic).',
            'translation_copy_editor_credit' => 'Margot Cortez.',
            'keywords' => 'Basin; ablution; Mamluk metalwork',
            'artist' => 'Muhammad ibn al-Zayn',
            'artist_period_of_activity' => 'Active about 1300',
            'artist_birth_date' => 'Unknown',
            'artist_birth_place' => 'Cairo (?)',
            'artist_death_date' => 'After 1320',
            'artist_death_place' => 'Damascus',
            'workshop' => 'Royal workshops of Cairo',
            'scribe' => 'Ibn al-Bawwab',
            'patrons' => 'Sultan al-Nasir Muhammad',
            'architects' => 'Unknown',
            'catalogue_references' => 'Ifriqiya, pp. 174-176',
            'notice' => 'This is an unedited Database entry.',
            'external_notice' => 'Cet objet est disponible aussi sur Gallica.',
            'image_rights' => 'Copyright image: Soprintendenza per i Beni Archeologici',
            'original_name' => 'Capa con capucha (*Burnous*)',
            'holder_original_name' => 'Museo Nacional de Antropología',
            'archival_reference' => 'ACS, Ministero armi e munizioni, fasc. 148, foto 2039',
            'external_sources' => 'Virtual visit: [https://example.org/tour](https://example.org/tour)',
        ];

        $this->putJson(route('item-translation.update', $resource), $texts)
            ->assertOk()
            ->assertJsonPath('data.short_description', $texts['short_description'])
            ->assertJsonPath('data.materials', $texts['materials'])
            ->assertJsonPath('data.dynasty', $texts['dynasty'])
            ->assertJsonPath('data.region', $texts['region'])
            ->assertJsonPath('data.history', $texts['history'])
            ->assertJsonPath('data.author_credit', $texts['author_credit'])
            ->assertJsonPath('data.translation_copy_editor_credit', $texts['translation_copy_editor_credit'])
            ->assertJsonPath('data.keywords', $texts['keywords'])
            ->assertJsonPath('data.artist', $texts['artist'])
            ->assertJsonPath('data.artist_death_place', $texts['artist_death_place'])
            ->assertJsonPath('data.architects', $texts['architects'])
            ->assertJsonPath('data.catalogue_references', $texts['catalogue_references'])
            ->assertJsonPath('data.external_notice', $texts['external_notice'])
            ->assertJsonPath('data.image_rights', $texts['image_rights'])
            ->assertJsonPath('data.external_sources', $texts['external_sources']);

        $this->assertDatabaseHas('item_translations', ['id' => $resource->id] + $texts);
    }

    /**
     * A translation is published unless it says otherwise (M16 B6); the
     * status takes only its three values.
     */
    public function test_status_defaults_to_published_and_takes_only_its_values(): void
    {
        $resource = ItemTranslation::factory()->create();
        $this->assertSame(ItemTranslationStatus::PUBLISHED, $resource->fresh()?->status);

        $this->putJson(route('item-translation.update', $resource), ['status' => 'hidden'])
            ->assertOk()
            ->assertJsonPath('data.status', 'hidden');
        $this->assertSame(ItemTranslationStatus::HIDDEN, $resource->fresh()?->status);

        $this->putJson(route('item-translation.update', $resource), ['status' => 'draft'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    /**
     * M17 B1 (#2744): a text is not a draft unless it says so; the API stores,
     * serves and lists a draft text like any other.
     */
    public function test_draft_is_stored_served_and_listed(): void
    {
        $resource = ItemTranslation::factory()->create();
        $this->assertFalse($resource->fresh()?->draft);

        $this->putJson(route('item-translation.update', $resource), ['draft' => true])
            ->assertOk()
            ->assertJsonPath('data.draft', true);
        $this->assertTrue($resource->fresh()?->draft);

        $this->getJson(route('item-translation.index'))
            ->assertOk()
            ->assertJsonFragment(['id' => $resource->id, 'draft' => true]);

        $this->putJson(route('item-translation.update', $resource), ['draft' => 'maybe'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('draft');
    }
}
