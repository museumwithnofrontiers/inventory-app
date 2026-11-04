<?php

namespace App\Models;

use App\Events\SpellingSaved;
use Database\Factories\GlossarySpellingFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\DB;

/**
 * GlossarySpelling Model
 *
 * Represents a specific spelling/variation of a Glossary entry in a particular language.
 */
class GlossarySpelling extends Model
{
    /** @use HasFactory<GlossarySpellingFactory> */
    use HasFactory, HasUuids;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::saved(function (GlossarySpelling $spelling): void {
            event(new SpellingSaved($spelling));
        });
    }

    /**
     * Delete the model from the database.
     * Ensures atomic deletion of the GlossarySpelling and its ItemTranslation links.
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

        // Fire the deleting event (for other listeners)
        if ($this->fireModelEvent('deleting') === false) {
            return false;
        }

        // Perform atomic deletion: detach item translations AND delete the model in one transaction
        return DB::transaction(function () {
            // First, detach all item translation links
            $this->itemTranslations()->detach();

            // Detach all collection translation links
            $this->collectionTranslations()->detach();

            // Detach all timeline event translation links
            $this->timelineEventTranslations()->detach();

            // Detach all dynasty translation links
            $this->dynastyTranslations()->detach();

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
    protected $table = 'glossary_spellings';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'glossary_id',
        'language_id',
        'spelling',
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
     * Get the glossary that owns this spelling.
     *
     * @return BelongsTo<Glossary, $this>
     */
    public function glossary(): BelongsTo
    {
        return $this->belongsTo(Glossary::class);
    }

    /**
     * Get the language of this spelling.
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /**
     * Get the item translations linked to this spelling.
     *
     * @return BelongsToMany<ItemTranslation, $this>
     */
    public function itemTranslations(): BelongsToMany
    {
        return $this->belongsToMany(ItemTranslation::class, 'item_translation_spelling', 'spelling_id', 'item_translation_id')
            ->withTimestamps();
    }

    /**
     * Get the collection translations linked to this spelling.
     *
     * @return BelongsToMany<CollectionTranslation, $this>
     */
    public function collectionTranslations(): BelongsToMany
    {
        return $this->belongsToMany(CollectionTranslation::class, 'collection_translation_spelling', 'spelling_id', 'collection_translation_id')
            ->withTimestamps();
    }

    /**
     * Get the timeline event translations linked to this spelling.
     *
     * @return BelongsToMany<TimelineEventTranslation, $this>
     */
    public function timelineEventTranslations(): BelongsToMany
    {
        return $this->belongsToMany(TimelineEventTranslation::class, 'timeline_event_translation_spelling', 'spelling_id', 'timeline_event_translation_id')
            ->withTimestamps();
    }

    /**
     * Get the dynasty translations linked to this spelling.
     *
     * @return BelongsToMany<DynastyTranslation, $this>
     */
    public function dynastyTranslations(): BelongsToMany
    {
        return $this->belongsToMany(DynastyTranslation::class, 'dynasty_translation_spelling', 'spelling_id', 'dynasty_translation_id')
            ->withTimestamps();
    }

    /**
     * Scope a query to only include spellings for a specific language.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForLanguage(Builder $query, string $languageId): Builder
    {
        return $query->where('language_id', $languageId);
    }

    /**
     * Scope a query to search for a specific spelling.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForSpelling(Builder $query, string $spelling): Builder
    {
        return $query->where('spelling', $spelling);
    }
}
