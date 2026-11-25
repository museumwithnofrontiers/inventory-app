<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * collection_partner's `level` and `collection_type` follow App\Enums\PartnerLevel
 * and App\Enums\CollectionPartnerType (#2796).
 *
 * Legacy's only thematic gallery exhibition partner category, "Other
 * contributor" ("Has made their material available"), is stored as
 * `material_provider`. `full_partner` and `co_organiser` map categories legacy
 * doesn't have; none is expected.
 *
 * The pivot model now casts both columns, so a stored value outside the enums
 * would make every page showing the link fail: after renaming, the migration
 * stops and names any such value.
 */
return new class extends Migration
{
    /** App\Enums\PartnerLevel's values when this migration was written. */
    private const LEVELS = ['partner', 'associated_partner', 'minor_contributor', 'material_provider'];

    /** App\Enums\CollectionPartnerType's values when this migration was written. */
    private const TYPES = ['collection', 'project', 'gallery', 'exhibition'];

    public function up(): void
    {
        DB::table('collection_partner')->where('level', 'other_contributor')->update(['level' => 'material_provider']);

        $levels = DB::table('collection_partner')
            ->whereNotNull('level')
            ->whereNotIn('level', self::LEVELS)
            ->distinct()
            ->pluck('level');
        $types = DB::table('collection_partner')
            ->whereNotIn('collection_type', self::TYPES)
            ->distinct()
            ->pluck('collection_type');

        if ($levels->isNotEmpty() || $types->isNotEmpty()) {
            throw new RuntimeException(
                'collection_partner holds values outside the enums: level '.$levels->implode(', ').'; collection_type '.$types->implode(', ')
            );
        }
    }

    public function down(): void
    {
        DB::table('collection_partner')->where('level', 'material_provider')->update(['level' => 'other_contributor']);
    }
};
