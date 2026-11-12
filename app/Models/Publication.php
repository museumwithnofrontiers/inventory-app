<?php

namespace App\Models;

use App\Enums\PublicationCategory;
use App\Enums\PublicationStatus;
use Database\Factories\PublicationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A publication: the work (legacy `bookbase`) that MWNF or a partner
 * published in print, print on demand or as an e-book. Its text lives in
 * PublicationTranslation (per language and context), each published version
 * in PublicationEdition, its covers and sample pages in PublicationImage.
 *
 * @property string $id
 * @property string $internal_name
 * @property string|null $backward_compatibility
 * @property PublicationCategory $category
 * @property string|null $project_id
 * @property string|null $country_id
 * @property string $language_id
 * @property PublicationStatus $status
 * @property int|null $display_order
 * @property object|null $extra
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Publication extends Model
{
    /** @use HasFactory<PublicationFactory> */
    use HasFactory, HasUuids;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'internal_name',
        'backward_compatibility',
        'category',
        'project_id',
        'country_id',
        'language_id',
        'status',
        'display_order',
        'extra',
    ];

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'published',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'category' => PublicationCategory::class,
        'status' => PublicationStatus::class,
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
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return BelongsTo<Country, $this>
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * The work's main language.
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /**
     * @return HasMany<PublicationTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(PublicationTranslation::class);
    }

    /**
     * @return HasMany<PublicationEdition, $this>
     */
    public function editions(): HasMany
    {
        return $this->hasMany(PublicationEdition::class);
    }

    /**
     * @return HasMany<PublicationImage, $this>
     */
    public function publicationImages(): HasMany
    {
        return $this->hasMany(PublicationImage::class);
    }

    /**
     * The sample and credits PDFs, served publicly at /doc.
     *
     * @return HasMany<PublicationDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(PublicationDocument::class);
    }

    /**
     * The collections this publication accompanies (an exhibition trail,
     * an exhibition, a gallery).
     *
     * @return BelongsToMany<Collection, $this, PublicationCollection>
     */
    public function collections(): BelongsToMany
    {
        return $this->belongsToMany(Collection::class, 'publication_collection')
            ->using(PublicationCollection::class)
            ->withPivot('display_order', 'extra')
            ->withTimestamps();
    }

    /**
     * The items this publication cites that are not reached through the
     * collections it accompanies.
     *
     * @return BelongsToMany<Item, $this, PublicationItem>
     */
    public function items(): BelongsToMany
    {
        return $this->belongsToMany(Item::class, 'publication_item')
            ->using(PublicationItem::class)
            ->withPivot('display_order', 'extra')
            ->withTimestamps();
    }

    /**
     * Subjects, themes and target readers.
     *
     * @return BelongsToMany<Tag, $this>
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'publication_tag')->withTimestamps();
    }
}
