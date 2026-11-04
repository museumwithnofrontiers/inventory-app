<?php

namespace Tests\Console;

use App\Models\CollectionTranslation;
use App\Models\DynastyTranslation;
use App\Models\GlossarySpelling;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\TimelineEventTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class GlossaryBulkResyncTest extends TestCase
{
    use RefreshDatabase;

    /**
     * GlossarySpelling::booted() dispatches SpellingSaved on every save, whose
     * listeners queue the legacy per-spelling sync jobs (SyncSpellingToItem
     * TranslationsEtc.). Tests force QUEUE_CONNECTION=sync, so without faking the
     * queue those jobs would run synchronously the moment a GlossarySpelling
     * factory creates a row — silently doing the exact linking work this test
     * suite means to exercise via glossary:bulk-resync, before the command under
     * test ever runs. Faking the queue keeps these tests honest: only
     * glossary:bulk-resync itself can produce the links being asserted on.
     */
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_syncs_matching_and_skips_non_matching_translations()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'pottery',
        ]);

        $match = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Ancient Pottery',
        ]);
        $noMatch = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Metal Sword',
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertTrue($match->fresh()->spellings->contains($spelling));
        $this->assertFalse($noMatch->fresh()->spellings->contains($spelling));
    }

    public function test_removes_stale_links_on_resync()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'pottery',
        ]);
        $translation = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Metal Sword',
        ]);
        $translation->spellings()->attach($spelling->id);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertCount(0, $translation->fresh()->spellings);
    }

    public function test_respects_word_boundaries()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'art',
        ]);
        $translation = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Artifact', // contains "art" but not as a whole word
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertFalse($translation->fresh()->spellings->contains($spelling));
    }

    public function test_only_links_translations_in_the_spellings_own_language()
    {
        $language1 = Language::factory()->create();
        $language2 = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language1->id,
            'spelling' => 'artifact',
        ]);

        $sameLanguage = ItemTranslation::factory()->create([
            'language_id' => $language1->id,
            'name' => 'Artifact Collection',
        ]);
        $otherLanguage = ItemTranslation::factory()->create([
            'language_id' => $language2->id,
            'name' => 'Artifact Collection',
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertTrue($sameLanguage->fresh()->spellings->contains($spelling));
        $this->assertFalse($otherLanguage->fresh()->spellings->contains($spelling));
    }

    public function test_escapes_regex_special_characters_in_spellings()
    {
        // Word characters on both ends (so the surrounding \b boundaries apply
        // cleanly) with an unescaped-regex-metacharacter in the middle — isolates
        // escaping specifically from the separate matter of a spelling that starts
        // or ends in punctuation (see test_matching_a_spelling_ending_in_punctuation
        // below for that case, which neither this command nor the legacy
        // per-spelling job can match, by design of the shared \b-wrapped pattern).
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'U.S.A', // '.' would match any character if left unescaped
        ]);
        $shouldMatch = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Made in U.S.A during the 1950s',
        ]);
        $shouldNotMatch = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Made in UXSXA during the 1950s', // would false-match if '.' were a wildcard
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertTrue($shouldMatch->fresh()->spellings->contains($spelling));
        $this->assertFalse($shouldNotMatch->fresh()->spellings->contains($spelling));
    }

    /**
     * Documents a real, pre-existing limitation shared with the legacy per-spelling
     * job (SyncSpellingToItemTranslations etc.): both wrap every spelling in
     * \b...\b, and \b can never match immediately after a non-word character (the
     * position is non-word-to-non-word, never a boundary) — so any spelling ending
     * in punctuation, like the real "Gilding (gold)" glossary entry, can never
     * match anywhere, regardless of which sync implementation runs. Not a
     * regression introduced by the bulk command; documented here so it isn't
     * mistaken for one.
     */
    public function test_matching_a_spelling_ending_in_punctuation()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'Gilding (gold)',
        ]);
        $translation = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'This item uses Gilding (gold) as decoration',
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertFalse($translation->fresh()->spellings->contains($spelling));
    }

    public function test_prefers_longest_spelling_when_one_contains_another()
    {
        $language = Language::factory()->create();
        $short = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'Silk Road',
        ]);
        $long = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'Silk Road Trade',
        ]);
        $translation = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Object from the Silk Road Trade era',
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertTrue($translation->fresh()->spellings->contains($long));
        $this->assertFalse($translation->fresh()->spellings->contains($short));
    }

    public function test_links_all_glossary_entries_sharing_the_same_spelling_text()
    {
        $language = Language::factory()->create();
        $spellingA = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'Ming',
        ]);
        $spellingB = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'Ming', // same text, different glossary entry
        ]);
        $translation = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Ming vase',
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $fresh = $translation->fresh()->spellings;
        $this->assertTrue($fresh->contains($spellingA));
        $this->assertTrue($fresh->contains($spellingB));
    }

    public function test_dry_run_does_not_write_any_links()
    {
        $language = Language::factory()->create();
        GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'pottery',
        ]);
        $translation = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Ancient Pottery',
        ]);

        $this->artisan('glossary:bulk-resync', ['--dry-run' => true])->assertExitCode(0);

        $this->assertCount(0, $translation->fresh()->spellings);
    }

    public function test_syncs_collection_and_timeline_event_translations_too()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'caravanserai',
        ]);
        $collectionTranslation = CollectionTranslation::factory()->create([
            'language_id' => $language->id,
            'title' => 'The Caravanserai Route',
        ]);
        $timelineEventTranslation = TimelineEventTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Founding of the Caravanserai',
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertTrue($collectionTranslation->fresh()->spellings->contains($spelling));
        $this->assertTrue($timelineEventTranslation->fresh()->spellings->contains($spelling));
    }

    public function test_syncs_dynasty_translations_too()
    {
        $language = Language::factory()->create();
        $spelling = GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'caravanserai',
        ]);
        $dynastyTranslation = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'history' => 'They built a caravanserai on every road.',
        ]);
        $unrelated = DynastyTranslation::factory()->create([
            'language_id' => $language->id,
            'history' => 'They minted coins.',
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertTrue($dynastyTranslation->fresh()->spellings->contains($spelling));
        $this->assertCount(0, $unrelated->fresh()->spellings);
    }

    public function test_is_idempotent()
    {
        $language = Language::factory()->create();
        GlossarySpelling::factory()->create([
            'language_id' => $language->id,
            'spelling' => 'pottery',
        ]);
        $translation = ItemTranslation::factory()->create([
            'language_id' => $language->id,
            'name' => 'Ancient Pottery',
        ]);

        $this->artisan('glossary:bulk-resync')->assertExitCode(0);
        $this->artisan('glossary:bulk-resync')->assertExitCode(0);
        $this->artisan('glossary:bulk-resync')->assertExitCode(0);

        $this->assertCount(1, $translation->fresh()->spellings);
    }
}
