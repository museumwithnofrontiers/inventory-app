<?php

namespace Tests\Unit\Models;

use App\Enums\ContributorCategory;
use App\Models\Contributor;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ContributorCategoryTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION = 'migrations/2026_11_25_110000_rename_contributor_credit_categories.php';

    public function test_the_enum_holds_the_eight_credits_and_one_value_per_legacy_category(): void
    {
        $credits = array_values(array_filter(ContributorCategory::cases(), fn (ContributorCategory $c): bool => $c->isCollectionCredit()));
        $thematic = array_values(array_filter(ContributorCategory::cases(), fn (ContributorCategory $c): bool => ! $c->isCollectionCredit()));

        $this->assertSame(
            ['author', 'source_text_author', 'prepared_by', 'curated_by', 'exhibition_credits', 'local_coordinator', 'local_team', 'photo_by'],
            array_column($credits, 'value')
        );
        // Legacy's contributor_category: cooperator, occasion, partner, sponsor.
        $this->assertSame(
            ['in_cooperation_with', 'on_the_occasion_of', 'main_contributors', 'with_the_support_of'],
            array_column($thematic, 'value')
        );
    }

    public function test_options_give_every_category_a_label(): void
    {
        $options = ContributorCategory::options();

        $this->assertSame(array_column(ContributorCategory::cases(), 'value'), array_keys($options));
        $this->assertSame('Source text author', $options['source_text_author']);
        $this->assertSame('With the support of', $options['with_the_support_of']);
    }

    public function test_the_category_is_stored_as_its_value_and_read_back_as_the_enum(): void
    {
        $contributor = Contributor::factory()->category(ContributorCategory::LOCAL_TEAM)->create();

        $this->assertSame('local_team', DB::table('contributors')->where('id', $contributor->id)->value('category'));
        $this->assertSame(ContributorCategory::LOCAL_TEAM, $contributor->fresh()?->category);
    }

    public function test_the_migration_renames_the_two_credits(): void
    {
        $author = Contributor::factory()->create();
        $credits = Contributor::factory()->create();
        DB::table('contributors')->where('id', $author->id)->update(['category' => 'travels_author']);
        DB::table('contributors')->where('id', $credits->id)->update(['category' => 'credits']);

        $this->migration()->up();

        $this->assertSame(ContributorCategory::SOURCE_TEXT_AUTHOR, $author->fresh()?->category);
        $this->assertSame(ContributorCategory::EXHIBITION_CREDITS, $credits->fresh()?->category);
    }

    public function test_the_migration_stops_on_a_category_outside_the_enum(): void
    {
        $contributor = Contributor::factory()->create();
        DB::table('contributors')->where('id', $contributor->id)->update(['category' => 'full_partner']);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('full_partner');

        $this->migration()->up();
    }

    private function migration(): Migration
    {
        /** @var Migration $migration */
        $migration = require database_path(self::MIGRATION);

        return $migration;
    }
}
