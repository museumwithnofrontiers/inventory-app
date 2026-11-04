<?php

namespace Tests\Integration\Jobs;

use App\Jobs\SyncSpellingToDynastyTranslations;
use App\Models\DynastyTranslation;
use App\Models\GlossarySpelling;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SyncSpellingToDynastyTranslationsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test job syncs spelling to matching dynasty translations.
     */
    public function test_syncs_spelling_to_matching_dynasty_translations()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);

        $translation1 = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Umayyad Dynasty',
        ]);
        $translation2 = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'history' => 'The dynasty ruled from 661 to 750',
        ]);
        $translation3 = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Battle of Tours',
        ]);

        $job = new SyncSpellingToDynastyTranslations($spelling->id);
        $job->handle();

        $this->assertTrue($translation1->fresh()->spellings->contains($spelling));
        $this->assertTrue($translation2->fresh()->spellings->contains($spelling));
        $this->assertFalse($translation3->fresh()->spellings->contains($spelling));
    }

    /**
     * Test job removes spelling from non-matching translations.
     */
    public function test_removes_spelling_from_non_matching_translations()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);

        $translation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Battle of Tours',
        ]);

        // Manually attach the spelling
        $translation->spellings()->attach($spelling->id);
        $this->assertCount(1, $translation->fresh()->spellings);

        // Run the sync job
        $job = new SyncSpellingToDynastyTranslations($spelling->id);
        $job->handle();

        // The spelling should be removed
        $this->assertCount(0, $translation->fresh()->spellings);
    }

    /**
     * Test job handles deleted spelling gracefully.
     */
    public function test_handles_deleted_spelling_gracefully()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
        ]);

        $spellingId = $spelling->id;
        $spelling->delete();

        $job = new SyncSpellingToDynastyTranslations($spellingId);
        $job->handle(); // Should not throw exception

        $this->assertTrue(true);
    }

    /**
     * Test job only processes translations in same language.
     */
    public function test_only_processes_translations_in_same_language()
    {
        $language1 = Language::factory()->create();
        $language2 = Language::factory()->create();

        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language1->id,
            'spelling' => 'caliphate',
        ]);

        $translation1 = DynastyTranslation::factory()->create([
            'language_id' => $language1->id,
            'name' => 'Umayyad Caliphate',
        ]);
        $translation2 = DynastyTranslation::factory()->create([
            'language_id' => $language2->id,
            'name' => 'Umayyad Caliphate',
        ]);

        $job = new SyncSpellingToDynastyTranslations($spelling->id);
        $job->handle();

        $this->assertTrue($translation1->fresh()->spellings->contains($spelling));
        $this->assertFalse($translation2->fresh()->spellings->contains($spelling));
    }

    /**
     * Test job searches date description fields.
     */
    public function test_searches_date_description_fields()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'conquest',
        ]);

        $translation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'No match',
            'date_description_ad' => 'After the conquest of Damascus',
        ]);

        $job = new SyncSpellingToDynastyTranslations($spelling->id);
        $job->handle();

        $this->assertTrue($translation->fresh()->spellings->contains($spelling));
    }

    /**
     * Test job is idempotent (can be run multiple times).
     */
    public function test_is_idempotent()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);

        $translation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Umayyad Dynasty',
        ]);

        $job = new SyncSpellingToDynastyTranslations($spelling->id);

        // Run the job multiple times
        $job->handle();
        $job->handle();
        $job->handle();

        // Should still have exactly one link
        $this->assertCount(1, $translation->fresh()->spellings);
    }
}
