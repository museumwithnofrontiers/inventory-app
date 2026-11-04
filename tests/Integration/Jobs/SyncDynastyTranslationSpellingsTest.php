<?php

namespace Tests\Integration\Jobs;

use App\Jobs\SyncDynastyTranslationSpellings;
use App\Models\DynastyTranslation;
use App\Models\GlossarySpelling;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SyncDynastyTranslationSpellingsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test job syncs matching spellings to dynasty translation.
     */
    public function test_syncs_matching_spellings_to_dynasty_translation()
    {
        $language = Language::factory()->create();
        $spelling1 = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);
        $spelling2 = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'umayyad',
        ]);
        $spelling3 = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'ceramic',
        ]);

        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Umayyad Dynasty',
            'history' => 'The Umayyad dynasty was a major caliphate',
        ]);

        $job = new SyncDynastyTranslationSpellings($dynastyTranslation->id);
        $job->handle();

        $linkedSpellings = $dynastyTranslation->fresh()->spellings->pluck('spelling')->toArray();
        $this->assertContains('dynasty', $linkedSpellings);
        $this->assertContains('umayyad', $linkedSpellings);
        $this->assertNotContains('ceramic', $linkedSpellings);
    }

    /**
     * Test job removes non-matching spellings.
     */
    public function test_removes_non_matching_spellings()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'pottery',
        ]);

        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Battle of Tours',
            'history' => 'A major battle in 732',
        ]);

        // Manually attach the spelling
        $dynastyTranslation->spellings()->attach($spelling->id);
        $this->assertCount(1, $dynastyTranslation->fresh()->spellings);

        // Run the sync job
        $job = new SyncDynastyTranslationSpellings($dynastyTranslation->id);
        $job->handle();

        // The spelling should be removed
        $this->assertCount(0, $dynastyTranslation->fresh()->spellings);
    }

    /**
     * Test job handles deleted dynasty translation gracefully.
     */
    public function test_handles_deleted_dynasty_translation_gracefully()
    {
        $language = Language::factory()->create();
        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
        ]);

        $dynastyTranslationId = $dynastyTranslation->id;
        $dynastyTranslation->delete();

        $job = new SyncDynastyTranslationSpellings($dynastyTranslationId);
        $job->handle(); // Should not throw exception

        $this->assertTrue(true);
    }

    /**
     * Test job only links spellings in same language.
     */
    public function test_only_links_spellings_in_same_language()
    {
        $language1 = Language::factory()->create();
        $language2 = Language::factory()->create();

        $spelling1 = GlossarySpelling::factory()->create([
            'language_id' => $language1->id,
            'spelling' => 'dynasty',
        ]);
        $spelling2 = GlossarySpelling::factory()->create([
            'language_id' => $language2->id,
            'spelling' => 'dynasty',
        ]);

        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language1->id,
            'name' => 'Umayyad Dynasty',
        ]);

        $job = new SyncDynastyTranslationSpellings($dynastyTranslation->id);
        $job->handle();

        $linkedSpellings = $dynastyTranslation->fresh()->spellings;
        $this->assertCount(1, $linkedSpellings);
        $this->assertEquals($spelling1->id, $linkedSpellings->first()->id);
    }

    /**
     * Test job is case-insensitive.
     */
    public function test_matching_is_case_insensitive()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'dynasty',
        ]);

        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'UMAYYAD DYNASTY',
        ]);

        $job = new SyncDynastyTranslationSpellings($dynastyTranslation->id);
        $job->handle();

        $linkedSpellings = $dynastyTranslation->fresh()->spellings->pluck('spelling')->toArray();
        $this->assertContains('dynasty', $linkedSpellings);
        $this->assertCount(1, $linkedSpellings);
    }
}
