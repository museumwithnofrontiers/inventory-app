<?php

namespace Tests\Console;

use App\Models\Collection;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Support\Census\ExtraCensus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class ExtraCensusCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $expectFile = '';

    protected function tearDown(): void
    {
        if ($this->expectFile !== '' && is_file($this->expectFile)) {
            unlink($this->expectFile);
        }

        parent::tearDown();
    }

    private function seedExtra(): void
    {
        $monument = Item::factory()->Monument()->withoutTranslations()->create();
        $picture = Item::factory()->Picture()->withoutTranslations()->create();

        ItemTranslation::factory()->for($monument)->create(['extra' => ['dimensions' => '3 m', 'prepared_by' => 'A. Author']]);
        ItemTranslation::factory()->for($picture)->create(['extra' => ['dimensions' => '20 cm']]);
        ItemTranslation::factory()->for($picture)->create(['extra' => []]);
        ItemTranslation::factory()->for($picture)->create(['extra' => null]);

        $collection = Collection::factory()->create(['extra' => ['thg_gallery' => ['slug' => 'water']]]);
        $collection->attachedItems()->attach($monument, ['display_order' => 1, 'extra' => ['mn_order' => 1]]);
        $collection->attachedItems()->attach($picture, ['display_order' => 2, 'extra' => null]);
    }

    public function test_it_finds_every_table_with_an_extra_column_from_the_schema(): void
    {
        $tables = app(ExtraCensus::class)->tables();

        $this->assertContains('item_translations', $tables);
        $this->assertContains('collection_item', $tables);
        $this->assertContains('partner_images', $tables);
        $this->assertNotContains('items', $tables);
    }

    public function test_it_counts_rows_and_top_level_keys_and_skips_empty_extra(): void
    {
        $this->seedExtra();

        $census = app(ExtraCensus::class)->run();

        $this->assertSame(2, $census['tables']['item_translations']['rows']);
        $this->assertSame(['dimensions' => 2, 'prepared_by' => 1], $census['tables']['item_translations']['keys']);
        $this->assertSame(['rows' => 1, 'keys' => ['mn_order' => 1]], $census['tables']['collection_item']);
        $this->assertSame(['rows' => 1, 'keys' => ['thg_gallery' => 1]], $census['tables']['collections']);
        $this->assertSame(['rows' => 0, 'keys' => []], $census['tables']['partner_images']);
        $this->assertSame(4, $census['total_rows']);
    }

    public function test_item_translations_are_also_counted_per_item_type(): void
    {
        $this->seedExtra();

        $byType = app(ExtraCensus::class)->run()['tables']['item_translations']['by_item_type'] ?? [];

        $this->assertSame([
            'monument' => ['rows' => 1, 'keys' => ['dimensions' => 1, 'prepared_by' => 1]],
            'picture' => ['rows' => 1, 'keys' => ['dimensions' => 1]],
        ], $byType);
    }

    public function test_json_output_is_the_census(): void
    {
        $this->seedExtra();

        $this->assertSame(0, Artisan::call('inventory:extra-census', ['--json' => true]));

        $this->assertSame(app(ExtraCensus::class)->run(), json_decode(Artisan::output(), true));
    }

    public function test_table_output_lists_the_keys(): void
    {
        $this->seedExtra();

        $this->artisan('inventory:extra-census')
            ->expectsOutputToContain('Total rows with extra: 4')
            ->expectsOutputToContain('prepared_by')
            ->assertExitCode(0);
    }

    public function test_expect_fails_when_a_key_that_should_be_gone_is_there(): void
    {
        $this->seedExtra();
        $this->writeExpectation(['collection_item' => ['keys' => ['mn_order' => 0]]]);

        $this->artisan('inventory:extra-census', ['--expect' => $this->expectFile])
            ->expectsOutputToContain('collection_item.extra.mn_order: 1 rows, at most 0 expected')
            ->assertExitCode(1);
    }

    public function test_expect_passes_when_every_key_is_within_its_ceiling(): void
    {
        $this->seedExtra();
        $this->writeExpectation([
            'item_translations' => ['keys' => ['dimensions' => 2, 'datation_method' => 0]],
            'publications' => ['keys' => ['date' => 0]],
        ]);

        $this->artisan('inventory:extra-census', ['--expect' => $this->expectFile])
            ->expectsOutputToContain('Every key is within its expected ceiling.')
            ->assertExitCode(0);
    }

    public function test_expect_alone_ignores_a_key_the_file_does_not_list(): void
    {
        $this->seedExtra();
        $this->writeExpectation(['item_translations' => ['keys' => ['dimensions' => 2]]]);

        $this->artisan('inventory:extra-census', ['--expect' => $this->expectFile])
            ->expectsOutputToContain('Every key is within its expected ceiling.')
            ->assertExitCode(0);
    }

    public function test_strict_fails_on_a_key_the_file_does_not_list(): void
    {
        $this->seedExtra();
        $this->writeExpectation(['item_translations' => ['keys' => ['dimensions' => 2]]]);

        $this->artisan('inventory:extra-census', ['--expect' => $this->expectFile, '--strict' => true])
            ->expectsOutputToContain('item_translations.extra.prepared_by: 1 rows, not listed in the expectation')
            ->expectsOutputToContain('collection_item.extra.mn_order: 1 rows, not listed in the expectation')
            ->expectsOutputToContain('collections.extra.thg_gallery: 1 rows, not listed in the expectation')
            ->assertExitCode(1);
    }

    public function test_strict_passes_when_every_key_is_listed_and_within_its_ceiling(): void
    {
        $this->seedExtra();
        $this->writeExpectation([
            'item_translations' => ['keys' => ['dimensions' => 2, 'prepared_by' => 1, 'datation_method' => 0]],
            'collection_item' => ['keys' => ['mn_order' => 1]],
            'collections' => ['keys' => ['thg_gallery' => 1]],
        ]);

        $this->artisan('inventory:extra-census', ['--expect' => $this->expectFile, '--strict' => true])
            ->expectsOutputToContain('Every key is listed and within its expected ceiling.')
            ->assertExitCode(0);
    }

    public function test_strict_still_fails_on_a_key_above_its_ceiling(): void
    {
        $this->seedExtra();
        $this->writeExpectation([
            'item_translations' => ['keys' => ['dimensions' => 1, 'prepared_by' => 1]],
            'collection_item' => ['keys' => ['mn_order' => 1]],
            'collections' => ['keys' => ['thg_gallery' => 1]],
        ]);

        $this->artisan('inventory:extra-census', ['--expect' => $this->expectFile, '--strict' => true])
            ->expectsOutputToContain('item_translations.extra.dimensions: 2 rows, at most 1 expected')
            ->assertExitCode(1);
    }

    public function test_strict_needs_an_expectation_file(): void
    {
        $this->artisan('inventory:extra-census', ['--strict' => true])
            ->expectsOutputToContain('--strict needs --expect')
            ->assertExitCode(1);
    }

    public function test_the_committed_expectation_lists_integer_ceilings_only(): void
    {
        $file = base_path('docs/models/extra-census.json');
        $this->assertFileExists($file);

        $expected = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($expected);
        $this->assertIsArray($expected['tables'] ?? null);

        foreach ($expected['tables'] as $table => $expectation) {
            $this->assertIsArray($expectation['keys'] ?? null, "{$table} has no keys");
            foreach ($expectation['keys'] as $key => $ceiling) {
                $this->assertIsInt($ceiling, "{$table}.{$key} is not an integer ceiling");
                $this->assertGreaterThanOrEqual(0, $ceiling, "{$table}.{$key} is negative");
            }
        }
    }

    public function test_expect_rejects_a_missing_or_malformed_file(): void
    {
        $this->artisan('inventory:extra-census', ['--expect' => '/nonexistent/census.json'])
            ->expectsOutputToContain('Expectation file not found')
            ->assertExitCode(1);

        $this->expectFile = (string) tempnam(sys_get_temp_dir(), 'census');
        file_put_contents($this->expectFile, '{"keys": {}}');

        $this->artisan('inventory:extra-census', ['--expect' => $this->expectFile])
            ->expectsOutputToContain('is not a census-shaped JSON object')
            ->assertExitCode(1);
    }

    /**
     * @param  array<string, array{keys: array<string, int>}>  $tables
     */
    private function writeExpectation(array $tables): void
    {
        $this->expectFile = (string) tempnam(sys_get_temp_dir(), 'census');
        file_put_contents($this->expectFile, (string) json_encode(['tables' => $tables]));
    }
}
