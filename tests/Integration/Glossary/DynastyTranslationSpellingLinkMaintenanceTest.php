<?php

namespace Tests\Integration\Glossary;

use App\Jobs\SyncDynastyTranslationSpellings;
use App\Jobs\SyncSpellingToDynastyTranslations;
use App\Models\DynastyTranslation;
use App\Models\GlossarySpelling;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class DynastyTranslationSpellingLinkMaintenanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    /**
     * Test creating dynasty translation dispatches sync job.
     */
    public function test_creating_dynasty_translation_dispatches_sync_job()
    {
        $language = Language::factory()->create();

        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Test Event',
        ]);

        Queue::assertPushed(SyncDynastyTranslationSpellings::class, function ($job) use ($dynastyTranslation) {
            return $job->dynastyTranslationId === $dynastyTranslation->id;
        });
    }

    /**
     * Test updating dynasty translation dispatches sync job.
     */
    public function test_updating_dynasty_translation_dispatches_sync_job()
    {
        $language = Language::factory()->create();
        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Original Name',
        ]);

        $dynastyTranslation->update(['name' => 'Updated Name']);

        Queue::assertPushed(SyncDynastyTranslationSpellings::class, function ($job) use ($dynastyTranslation) {
            return $job->dynastyTranslationId === $dynastyTranslation->id;
        });
    }

    /**
     * Test deleting dynasty translation detaches spellings synchronously.
     */
    public function test_deleting_dynasty_translation_detaches_spellings_synchronously()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);

        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Umayyad Dynasty',
        ]);
        $dynastyTranslation->spellings()->attach($spelling->id);

        $translationId = $dynastyTranslation->id;
        $dynastyTranslation->delete();

        $this->assertDatabaseMissing('dynasty_translation_spelling', [
            'dynasty_translation_id' => $translationId,
        ]);
    }

    /**
     * Test creating spelling dispatches sync job for dynasty translations.
     */
    public function test_creating_spelling_dispatches_sync_job_for_dynasty_translations()
    {
        $language = Language::factory()->create();

        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);

        Queue::assertPushed(SyncSpellingToDynastyTranslations::class, function ($job) use ($spelling) {
            return $job->spellingId === $spelling->id;
        });
    }

    /**
     * Test deleting spelling detaches from all dynasty translations synchronously.
     */
    public function test_deleting_spelling_detaches_from_all_dynasty_translations_synchronously()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);

        $translation1 = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Dynasty Event 1',
        ]);
        $translation2 = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Dynasty Event 2',
        ]);
        $translation1->spellings()->attach($spelling->id);
        $translation2->spellings()->attach($spelling->id);

        $spelling->delete();

        $this->assertDatabaseMissing('dynasty_translation_spelling', [
            'spelling_id' => $spelling->id,
        ]);
    }

    /**
     * Integration test: Create dynasty translation with matching spelling.
     */
    public function test_integration_create_dynasty_translation_with_matching_spelling()
    {
        Queue::fake([]);

        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);

        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Umayyad Dynasty',
        ]);

        // Manually dispatch the job (simulating queue worker)
        $job = new SyncDynastyTranslationSpellings($dynastyTranslation->id);
        $job->handle();

        $this->assertTrue($dynastyTranslation->fresh()->spellings->contains($spelling));
    }
}
