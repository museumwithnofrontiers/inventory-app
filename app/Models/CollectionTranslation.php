<?php

namespace App\Models;

use App\Events\CollectionTranslationSaved;
use App\Traits\HasJsonFields;
use Database\Factories\CollectionTranslationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * CollectionTranslation Model
 *
 * Represents language and context-specific translations for Collections.
 * Supports internationalization and contextualization of Collection content.
 *
 * @property string $collection_id
 * @property string $language_id
 * @property string $context_id
 * @property string|null $title
 * @property string|null $subtitle
 * @property string|null $description
 * @property string|null $introduction
 * @property string|null $duration
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class CollectionTranslation extends Model
{
    /** @use HasFactory<CollectionTranslationFactory> */
    use HasFactory, HasJsonFields, HasUuids;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::saved(function (CollectionTranslation $collectionTranslation): void {
            event(new CollectionTranslationSaved($collectionTranslation));
        });
    }

    /**
     * Delete the model from the database.
     * Ensures atomic deletion of the CollectionTranslation and its spelling links.
     *
     * @return bool|null
     *
     * @throws \LogicException
     */
    public function delete()
    {
        // If the model doesn't exist, nothing to delete
        if (! $this->exists) {
            return false;
        }

        // Fire the deleting event (for other listeners, not for spelling detachment)
        if ($this->fireModelEvent('deleting') === false) {
            return false;
        }

        // Perform atomic deletion: detach spellings AND delete the model in one transaction
        return DB::transaction(function () {
            // First, detach all spelling links
            $this->spellings()->detach();

            // Then perform the actual deletion
            $this->performDeleteOnModel();

            // Mark the model as non-existing
            $this->exists = false;

            // Fire the deleted event
            $this->fireModelEvent('deleted', false);

            return true;
        });
    }

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'collection_translations';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'collection_id',
        'language_id',
        'context_id',
        'title',
        'subtitle',
        'description',
        'introduction',
        'quote',
        'duration',
        'url',
        'backward_compatibility',
        'extra',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'extra' => 'object',
    ];

    /**
     * Get the unique identifiers for the model.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * Get the extra field decoded as an associative array.
     *
     * @return Attribute<mixed, never>
     */
    protected function extraDecoded(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->normalizedJson('extra')
        );
    }

    /** @return BelongsTo<Collection, $this> */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /** @return BelongsTo<Language, $this> */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /** @return BelongsTo<Context, $this> */
    public function context(): BelongsTo
    {
        return $this->belongsTo(Context::class);
    }

    /**
     * Get the glossary spellings linked to this collection translation.
     *
     * @return BelongsToMany<GlossarySpelling, $this>
     */
    public function spellings(): BelongsToMany
    {
        return $this->belongsToMany(GlossarySpelling::class, 'collection_translation_spelling', 'collection_translation_id', 'spelling_id')
            ->withTimestamps();
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeDefaultContext(Builder $query): Builder
    {
        return $query->whereHas('context', function ($query) {
            $query->where('is_default', true);
        });
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForLanguage(Builder $query, string $languageId): Builder
    {
        return $query->where('language_id', $languageId);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForContext(Builder $query, string $contextId): Builder
    {
        return $query->where('context_id', $contextId);
    }

    /**
     * Get sibling translations (other translations of the same collection).
     *
     * @return HasMany<CollectionTranslation, $this>
     */
    public function siblingTranslations(): HasMany
    {
        return $this->hasMany(self::class, 'collection_id', 'collection_id');
    }
}
