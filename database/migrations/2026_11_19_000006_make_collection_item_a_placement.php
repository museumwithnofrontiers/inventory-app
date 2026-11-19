<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Ramsey\Uuid\Uuid;

/**
 * M16 C1 (#2641): an item on a collection becomes a record, the placement.
 *
 * The placement gets its own UUID `id`, and `(collection_id, item_id)` stays
 * unique. Legacy's placement fields get columns of their own:
 * - `variant_order`: its variant number (legacy `n2`);
 * - `parent_variant_order`: for a detail view, the variant number of the view
 *   it belongs to (legacy `parent_n2`). These are positions, kept as written
 *   (decision on #2641): a view's group is the same collection, the same
 *   `display_order` and that variant number. Some views have no parent
 *   placement at all, so the position isn't a link;
 * - `picture_item_id`: the picture the placement shows;
 * - `curator_selected`: the curator's flag. NULL means legacy didn't say.
 *
 * Existing rows get the id the importer gives them (UUIDv5 of the pair in the
 * importer's namespace, `scripts/importer/src/utils/deterministic-uuid.ts`),
 * so a migrated database and a reimported one agree.
 */
return new class extends Migration
{
    /** The importer's frozen UUIDv5 namespace. */
    private const IMPORTER_UUID_NAMESPACE = 'bc112041-0784-4475-80b2-0c96425ac5ea';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('collection_item', function (Blueprint $table) {
            $table->uuid('id')->nullable()->first();
        });

        DB::table('collection_item')
            ->select(['collection_id', 'item_id'])
            ->orderBy('collection_id')
            ->orderBy('item_id')
            ->lazy(1000)
            ->each(function (object $row): void {
                /** @var object{collection_id: string, item_id: string} $row */
                DB::table('collection_item')
                    ->where('collection_id', $row->collection_id)
                    ->where('item_id', $row->item_id)
                    ->update(['id' => self::placementId($row->collection_id, $row->item_id)]);
            });

        Schema::table('collection_item', function (Blueprint $table) {
            $table->unique(['collection_id', 'item_id']);
        });

        Schema::table('collection_item', function (Blueprint $table) {
            $table->dropPrimary(['collection_id', 'item_id']);
        });

        Schema::table('collection_item', function (Blueprint $table) {
            $table->uuid('id')->nullable(false)->change();
            $table->primary('id');
            $table->integer('variant_order')->nullable()->after('display_order');
            $table->integer('parent_variant_order')->nullable()->after('variant_order');
            $table->foreignUuid('picture_item_id')->nullable()->after('parent_variant_order')
                ->constrained('items')->nullOnDelete();
            $table->boolean('curator_selected')->nullable()->after('picture_item_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('collection_item', function (Blueprint $table) {
            $table->dropForeign(['picture_item_id']);
            $table->dropColumn(['variant_order', 'parent_variant_order', 'picture_item_id', 'curator_selected']);
        });

        Schema::table('collection_item', function (Blueprint $table) {
            $table->dropPrimary(['id']);
        });

        Schema::table('collection_item', function (Blueprint $table) {
            $table->primary(['collection_id', 'item_id']);
        });

        Schema::table('collection_item', function (Blueprint $table) {
            $table->dropUnique(['collection_id', 'item_id']);
            $table->dropColumn('id');
        });
    }

    /** The importer's id for a placement: UUIDv5 of the pair. */
    public static function placementId(string $collectionId, string $itemId): string
    {
        return Uuid::uuid5(self::IMPORTER_UUID_NAMESPACE, "collection_item:{$collectionId}:{$itemId}")->toString();
    }
};
