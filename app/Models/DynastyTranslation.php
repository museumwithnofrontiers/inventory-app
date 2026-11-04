<?php

namespace App\Models;

use App\Events\DynastyTranslationSaved;
use App\Traits\HasJsonFields;
use Database\Factories\DynastyTranslationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * DynastyTranslation Model
 *
 * Represents language-specific translations for Dynasties.
 * Contains translated dynasty names, areas, and historical descriptions.
 *
 * @property string $dynasty_id
 * @property string $language_id
 * @property string|null $name
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class DynastyTranslation extends Model
{
    /** @use HasFactory<DynastyTranslationFactory> */
    use HasFactory, HasJsonFields, HasUuids;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::saved(function (DynastyTranslation $dynastyTranslation): void {
            event(new DynastyTranslationSaved($dynastyTranslation));
        });
    }

    /**
     * Delete the model from the database.
     * Ensures atomic deletion of the DynastyTranslation and its spelling links.
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
    protected $table = 'dynasty_translations';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'dynasty_id',
        'language_id',
        'name',
        'also_known_as',
        'area',
        'history',
        'date_description_ah',
        'date_description_ad',
        'author_id',
        'text_copy_editor_id',
        'translator_id',
        'translation_copy_editor_id',
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

    /**
     * Get the dynasty that owns the translation.
     *
     * @return BelongsTo<Dynasty, $this>
     */
    public function dynasty(): BelongsTo
    {
        return $this->belongsTo(Dynasty::class);
    }

    /**
     * Get the language of the translation.
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /**
     * Get the author of the translation.
     *
     * @return BelongsTo<Author, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(Author::class, 'author_id');
    }

    /**
     * Get the text copy editor.
     *
     * @return BelongsTo<Author, $this>
     */
    public function textCopyEditor(): BelongsTo
    {
        return $this->belongsTo(Author::class, 'text_copy_editor_id');
    }

    /**
     * Get the translator.
     *
     * @return BelongsTo<Author, $this>
     */
    public function translator(): BelongsTo
    {
        return $this->belongsTo(Author::class, 'translator_id');
    }

    /**
     * Get the translation copy editor.
     *
     * @return BelongsTo<Author, $this>
     */
    public function translationCopyEditor(): BelongsTo
    {
        return $this->belongsTo(Author::class, 'translation_copy_editor_id');
    }

    /**
     * Get the glossary spellings linked to this dynasty translation.
     *
     * @return BelongsToMany<GlossarySpelling, $this>
     */
    public function spellings(): BelongsToMany
    {
        return $this->belongsToMany(GlossarySpelling::class, 'dynasty_translation_spelling', 'dynasty_translation_id', 'spelling_id')
            ->withTimestamps();
    }

    /**
     * Scope a query to only include translations for a specific language.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForLanguage(Builder $query, string $languageId): Builder
    {
        return $query->where('language_id', $languageId);
    }
}
