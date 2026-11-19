<?php

namespace App\Models;

use App\Enums\LinkType;
use App\Traits\HasDisplayOrder;
use Database\Factories\LinkFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * A link to something outside the inventory (M16 F3, #2653): a video, a
 * document, a website, a shop, a catalogue entry… Owned by an item, a
 * collection, a partner or a publication edition, optionally in one language.
 * It replaces ItemMedia and CollectionMedia.
 *
 * @property string $id
 * @property string $linkable_type
 * @property string $linkable_id
 * @property string|null $language_id
 * @property LinkType $type
 * @property string|null $title
 * @property string $url
 * @property string|null $description
 * @property string|null $authors
 * @property int|null $category the legacy category id (the site names it)
 * @property string|null $resource_type
 * @property string|null $location
 * @property string|null $country_code
 * @property string|null $further_reading
 * @property int $display_order
 * @property object|null $extra
 * @property string|null $backward_compatibility
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Link extends Model
{
    /** @use HasFactory<LinkFactory> */
    use HasDisplayOrder, HasFactory, HasUuids;

    /**
     * The owners a link can have, by their morph alias (AppServiceProvider).
     *
     * @var array<string, class-string<Model>>
     */
    public const OWNERS = [
        'item' => Item::class,
        'collection' => Collection::class,
        'partner' => Partner::class,
        'publication_edition' => PublicationEdition::class,
    ];

    protected $fillable = [
        'language_id',
        'type',
        'title',
        'url',
        'description',
        'authors',
        'category',
        'resource_type',
        'location',
        'country_code',
        'further_reading',
        'display_order',
        'extra',
        'backward_compatibility',
    ];

    protected $casts = [
        'type' => LinkType::class,
        'category' => 'integer',
        'display_order' => 'integer',
        'extra' => 'object',
    ];

    /**
     * Get the columns that should automatically receive a unique identifier.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * The item, collection, partner or publication edition this link belongs to.
     *
     * @return MorphTo<Model, $this>
     */
    public function linkable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * The language of this link, if it has one.
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /**
     * Siblings for the display order: the same owner's links of the same type.
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('linkable_type', $this->linkable_type)
            ->where('linkable_id', $this->linkable_id)
            ->where('type', $this->type);

        return $query;
    }
}
