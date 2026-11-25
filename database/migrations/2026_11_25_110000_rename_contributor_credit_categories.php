<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Contributor categories follow App\Enums\ContributorCategory (#2795). Two
 * collection credits get names that say what they are:
 * - `travels_author` → `source_text_author`, the author of a text the
 *   collection reuses;
 * - `credits` → `exhibition_credits`, an exhibition's block of credit lines.
 *
 * The model now casts the column to the enum, so a stored value outside it
 * would make every page showing the contributor fail: after renaming, the
 * migration stops and names any such value.
 */
return new class extends Migration
{
    private const RENAMES = [
        'travels_author' => 'source_text_author',
        'credits' => 'exhibition_credits',
    ];

    /** App\Enums\ContributorCategory's values when this migration was written. */
    private const CATEGORIES = [
        'author',
        'source_text_author',
        'prepared_by',
        'curated_by',
        'exhibition_credits',
        'local_coordinator',
        'local_team',
        'photo_by',
        'in_cooperation_with',
        'on_the_occasion_of',
        'main_contributors',
        'with_the_support_of',
    ];

    public function up(): void
    {
        foreach (self::RENAMES as $from => $to) {
            DB::table('contributors')->where('category', $from)->update(['category' => $to]);
        }

        $unknown = DB::table('contributors')
            ->whereNotIn('category', self::CATEGORIES)
            ->distinct()
            ->pluck('category');

        if ($unknown->isNotEmpty()) {
            throw new RuntimeException('contributors.category holds values outside ContributorCategory: '.$unknown->implode(', '));
        }
    }

    public function down(): void
    {
        foreach (self::RENAMES as $from => $to) {
            DB::table('contributors')->where('category', $to)->update(['category' => $from]);
        }
    }
};
