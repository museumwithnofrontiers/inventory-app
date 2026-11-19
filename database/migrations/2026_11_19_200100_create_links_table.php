<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M16 F3 (#2653): one Link model, owned by an item, a collection, a partner
 * or a publication edition, replaces ItemMedia and CollectionMedia.
 *
 * The media rows move over with their ids, so nothing that refers to them
 * changes; the two tables are then dropped. `down()` gives them back.
 *
 * The related-content keys an exporter reads (ADR 006 rule 5) leave `extra`
 * for columns of their own, as written: `authors`, the legacy category id
 * (the site names it), the resource type, the location and country code of
 * the linked entity, and the further-reading text.
 */
return new class extends Migration
{
    /** @var array<string, array{table: string, key: string, owner: string}> */
    private const MEDIA = [
        'item_media' => ['table' => 'item_media', 'key' => 'item_id', 'owner' => 'item'],
        'collection_media' => ['table' => 'collection_media', 'key' => 'collection_id', 'owner' => 'collection'],
    ];

    private const COLUMNS = ['id', 'language_id', 'type', 'title', 'description', 'url', 'display_order', 'extra', 'backward_compatibility', 'created_at', 'updated_at'];

    /** Legacy `extra` key => its Link column. */
    private const KEYS = [
        'authors' => 'authors',
        'category_id' => 'category',
        'type_resource' => 'resource_type',
        'entity_location' => 'location',
        'entity_country' => 'country_code',
        'further_reading' => 'further_reading',
    ];

    public function up(): void
    {
        Schema::create('links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuidMorphs('linkable');
            $table->string('language_id', 3)->nullable();
            $table->string('type', 32);
            $table->string('title')->nullable();
            $table->string('url', 2048);
            $table->text('description')->nullable();
            $table->text('authors')->nullable();
            $table->unsignedTinyInteger('category')->nullable();
            $table->string('resource_type')->nullable();
            $table->string('location')->nullable();
            $table->string('country_code', 16)->nullable();
            $table->text('further_reading')->nullable();
            $table->integer('display_order')->default(0);
            $table->json('extra')->nullable();
            $table->string('backward_compatibility')->nullable();
            $table->timestamps();

            $table->foreign('language_id')->references('id')->on('languages')->onDelete('set null');
            $table->index(['linkable_type', 'linkable_id', 'type', 'display_order']);
            $table->index('backward_compatibility');
        });

        foreach (self::MEDIA as $media) {
            DB::table($media['table'])->orderBy('id')->chunk(500, function ($rows) use ($media) {
                DB::table('links')->insert($rows->map(fn (object $row): array => [
                    ...array_intersect_key((array) $row, array_flip(self::COLUMNS)),
                    'linkable_type' => $media['owner'],
                    'linkable_id' => $row->{$media['key']},
                    ...$this->keysOutOfExtra($row->extra),
                ])->all());
            });
        }

        Schema::dropIfExists('item_media');
        Schema::dropIfExists('collection_media');
    }

    /**
     * The related-content keys out of a media row's `extra`, into their columns.
     *
     * @return array<string, mixed>
     */
    private function keysOutOfExtra(?string $extra): array
    {
        $columns = array_fill_keys(array_values(self::KEYS), null);
        $decoded = $extra === null ? null : json_decode($extra, true);
        if (! is_array($decoded)) {
            return [...$columns, 'extra' => $extra];
        }
        foreach (self::KEYS as $key => $column) {
            if (array_key_exists($key, $decoded) && (is_string($decoded[$key]) || is_int($decoded[$key]))) {
                $columns[$column] = $decoded[$key];
                unset($decoded[$key]);
            }
        }

        return [...$columns, 'extra' => $decoded === [] ? null : json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)];
    }

    /**
     * A link's related-content columns back into its `extra`.
     */
    private function keysIntoExtra(object $row): ?string
    {
        $extra = json_decode($row->extra ?? '{}', true) ?: [];
        foreach (self::KEYS as $key => $column) {
            if ($row->{$column} !== null) {
                $extra[$key] = $row->{$column};
            }
        }

        return $extra === [] ? null : json_encode($extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function down(): void
    {
        Schema::create('item_media', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('item_id');
            $table->string('language_id', 3)->nullable();
            $table->enum('type', ['audio', 'video']);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('url', 512);
            $table->integer('display_order')->default(0);
            $table->json('extra')->nullable();
            $table->string('backward_compatibility')->nullable();
            $table->timestamps();

            $table->foreign('item_id')->references('id')->on('items')->onDelete('cascade');
            $table->foreign('language_id')->references('id')->on('languages')->onDelete('set null');
            $table->index(['item_id', 'type', 'display_order']);
        });

        Schema::create('collection_media', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('collection_id');
            $table->string('language_id', 3)->nullable();
            $table->enum('type', ['audio', 'video', 'document']);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('url', 512);
            $table->integer('display_order')->default(0);
            $table->json('extra')->nullable();
            $table->string('backward_compatibility')->nullable();
            $table->timestamps();

            $table->foreign('collection_id')->references('id')->on('collections')->onDelete('cascade');
            $table->foreign('language_id')->references('id')->on('languages')->onDelete('set null');
            $table->index(['collection_id', 'type', 'display_order']);
        });

        $types = ['item_media' => ['audio', 'video'], 'collection_media' => ['audio', 'video', 'document']];
        foreach (self::MEDIA as $name => $media) {
            DB::table('links')->where('linkable_type', $media['owner'])->whereIn('type', $types[$name])
                ->orderBy('id')->chunk(500, function ($rows) use ($media) {
                    DB::table($media['table'])->insert($rows->map(fn (object $row): array => [
                        ...array_intersect_key((array) $row, array_flip(self::COLUMNS)),
                        $media['key'] => $row->linkable_id,
                        'title' => $row->title ?? '',
                        'extra' => $this->keysIntoExtra($row),
                    ])->all());
                });
        }

        Schema::dropIfExists('links');
    }
};
