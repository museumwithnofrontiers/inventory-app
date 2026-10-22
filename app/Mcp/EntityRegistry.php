<?php

namespace App\Mcp;

use App\Models\ImageUpload;
use App\Support\Includes\AllowList;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * The inventory entities the MCP server can browse, each with its model,
 * its API resource (so the MCP returns what the API returns) and its
 * include allow-list. Users, roles, permissions and settings are left out:
 * they are administration, not inventory.
 *
 * tests/Api/Mcp/EntityRegistryTest.php fails when a model with an API
 * resource is neither registered here nor listed in EXCLUDED.
 */
final class EntityRegistry
{
    /**
     * The entity types. Each is the snake-cased basename of its model
     * (App\Models\ItemTranslation is `item_translation`) and its resource
     * (App\Http\Resources\ItemTranslationResource).
     */
    private const TYPES = [
        'item', 'item_translation', 'item_image', 'item_item_link', 'item_item_link_translation',
        'item_media', 'item_document',
        'collection', 'collection_translation', 'collection_image', 'collection_media',
        'partner', 'partner_translation', 'partner_image', 'partner_logo', 'partner_translation_image',
        'contributor', 'contributor_translation', 'contributor_image',
        'timeline', 'timeline_event', 'timeline_event_translation', 'timeline_event_image',
        'glossary', 'glossary_translation', 'glossary_spelling',
        'author', 'author_translation', 'artist', 'workshop', 'dynasty', 'dynasty_translation', 'tag',
        'country', 'country_translation', 'language', 'language_translation', 'context', 'project',
        'available_image',
    ];

    /**
     * Entity types whose include allow-list is keyed differently.
     */
    private const INCLUDE_KEYS = [
        'item_image' => 'itemImage',
        'collection_image' => 'collectionImage',
    ];

    /**
     * Models with an API resource the MCP server deliberately does not offer.
     *
     * @var array<class-string<Model>, string>
     */
    public const EXCLUDED = [
        ImageUpload::class => 'a transient upload, removed once processed',
    ];

    /**
     * Columns searched for free text, where the table has them: the same
     * convention as the panel's record selects.
     */
    private const SEARCH_COLUMNS = ['id', 'internal_name', 'backward_compatibility', 'name'];

    /**
     * @return array<int, string>
     */
    public static function types(): array
    {
        return self::TYPES;
    }

    public static function has(string $type): bool
    {
        return in_array($type, self::TYPES, true);
    }

    /**
     * @return class-string<Model>
     */
    public static function model(string $type): string
    {
        self::assertKnown($type);

        /** @var class-string<Model> */
        return 'App\\Models\\'.Str::studly($type);
    }

    /**
     * @return class-string<JsonResource>
     */
    public static function resource(string $type): string
    {
        self::assertKnown($type);

        /** @var class-string<JsonResource> */
        return 'App\\Http\\Resources\\'.Str::studly($type).'Resource';
    }

    /**
     * @return array<int, string>
     */
    public static function includes(string $type): array
    {
        self::assertKnown($type);

        return AllowList::for(self::INCLUDE_KEYS[$type] ?? $type);
    }

    public static function table(string $type): string
    {
        $model = self::model($type);

        return (new $model)->getTable();
    }

    /**
     * The table's columns, minus the model's hidden attributes.
     *
     * @return array<int, string>
     */
    public static function columns(string $type): array
    {
        $model = self::model($type);

        return array_values(array_diff(Schema::getColumnListing(self::table($type)), (new $model)->getHidden()));
    }

    /**
     * @return array<int, string>
     */
    public static function searchColumns(string $type): array
    {
        return array_values(array_intersect(self::SEARCH_COLUMNS, self::columns($type)));
    }

    /**
     * The type of an entity model, or null when the model is not registered.
     */
    public static function typeOf(Model $record): ?string
    {
        $type = Str::snake(class_basename($record));

        return self::has($type) ? $type : null;
    }

    private static function assertKnown(string $type): void
    {
        if (! self::has($type)) {
            throw new InvalidArgumentException("Unknown entity type [{$type}]. Call list_entity_types for the known types.");
        }
    }
}
