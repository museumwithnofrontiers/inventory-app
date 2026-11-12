<?php

namespace App\Models;

use App\Enums\PublicationFormat;
use Database\Factories\PublicationEditionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One published version of a publication (legacy `books`): one language,
 * publisher, format and edition number. It has no translations, since it
 * exists in one language by definition, and nothing commercial: no price,
 * discount, distributor or availability. The legacy shop links are kept in
 * `extra.shop_links`, the edition's own text variants in
 * `extra.legacy_texts`.
 *
 * @property string $id
 * @property string $publication_id
 * @property string $language_id
 * @property PublicationFormat $format
 * @property int|null $edition
 * @property int|null $publish_year
 * @property string|null $isbn
 * @property string|null $publisher
 * @property int|null $page_count
 * @property int|null $image_count
 * @property int|null $plan_count
 * @property string|null $dimensions
 * @property string|null $binding
 * @property bool $visible
 * @property int|null $display_order
 * @property string|null $backward_compatibility
 * @property object|null $extra
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PublicationEdition extends Model
{
    /** @use HasFactory<PublicationEditionFactory> */
    use HasFactory, HasUuids;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'publication_id',
        'language_id',
        'format',
        'edition',
        'publish_year',
        'isbn',
        'publisher',
        'page_count',
        'image_count',
        'plan_count',
        'dimensions',
        'binding',
        'visible',
        'display_order',
        'backward_compatibility',
        'extra',
    ];

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'visible' => true,
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'format' => PublicationFormat::class,
        'edition' => 'integer',
        'publish_year' => 'integer',
        'page_count' => 'integer',
        'image_count' => 'integer',
        'plan_count' => 'integer',
        'visible' => 'boolean',
        'display_order' => 'integer',
        'extra' => 'object',
    ];

    /**
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * @return BelongsTo<Publication, $this>
     */
    public function publication(): BelongsTo
    {
        return $this->belongsTo(Publication::class);
    }

    /**
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /**
     * The covers of this edition.
     *
     * @return HasMany<PublicationImage, $this>
     */
    public function publicationImages(): HasMany
    {
        return $this->hasMany(PublicationImage::class);
    }
}
