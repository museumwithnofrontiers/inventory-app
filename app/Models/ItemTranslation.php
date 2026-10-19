<?php

namespace App\Models;

use App\Enums\CreditRole;
use App\Events\ItemTranslationSaved;
use App\Traits\HasJsonFields;
use Database\Factories\ItemTranslationFactory;
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
 * ItemTranslation Model
 *
 * Represents language and context-specific translations for Items.
 * Supports internationalization and contextualization of Item content.
 *
 * @property string $item_id
 * @property string $language_id
 * @property string $context_id
 * @property string|null $name
 * @property string|null $description
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ItemTranslation extends Model
{
    /** @use HasFactory<ItemTranslationFactory> */
    use HasFactory, HasJsonFields, HasUuids;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::saved(function (ItemTranslation $itemTranslation): void {
            event(new ItemTranslationSaved($itemTranslation));
        });
    }

    /**
     * Delete the model from the database.
     * Ensures atomic deletion of the ItemTranslation and its spelling links.
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
    protected $table = 'item_translations';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'item_id',
        'language_id',
        'context_id',
        'name',
        'alternate_name',
        'description',
        'type',
        'holder',
        'owner',
        'initial_owner',
        'dates',
        'location',
        'dimensions',
        'place_of_production',
        'method_for_datation',
        'method_for_provenance',
        'provenance',
        'obtention',
        'bibliography',
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

    /** @return BelongsTo<Item, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
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
     * Get every person credited on this translation, in each role, in order.
     *
     * @return BelongsToMany<Author, $this, ItemTranslationAuthor>
     */
    public function credits(): BelongsToMany
    {
        return $this->belongsToMany(Author::class, 'item_translation_author')
            ->using(ItemTranslationAuthor::class)
            ->withPivot('role', 'display_order')
            ->withTimestamps()
            ->orderByPivot('role')
            ->orderByPivot('display_order');
    }

    /**
     * Get the people credited in one role, in order. Attaching through it
     * sets the role.
     *
     * @return BelongsToMany<Author, $this, ItemTranslationAuthor>
     */
    public function creditsAs(CreditRole $role): BelongsToMany
    {
        return $this->belongsToMany(Author::class, 'item_translation_author')
            ->using(ItemTranslationAuthor::class)
            ->withPivot('role', 'display_order')
            ->withPivotValue('role', $role->value)
            ->withTimestamps()
            ->orderByPivot('display_order');
    }

    /** @return BelongsToMany<Author, $this, ItemTranslationAuthor> */
    public function authorCredits(): BelongsToMany
    {
        return $this->creditsAs(CreditRole::AUTHOR);
    }

    /** @return BelongsToMany<Author, $this, ItemTranslationAuthor> */
    public function textCopyEditorCredits(): BelongsToMany
    {
        return $this->creditsAs(CreditRole::TEXT_COPY_EDITOR);
    }

    /** @return BelongsToMany<Author, $this, ItemTranslationAuthor> */
    public function translatorCredits(): BelongsToMany
    {
        return $this->creditsAs(CreditRole::TRANSLATOR);
    }

    /** @return BelongsToMany<Author, $this, ItemTranslationAuthor> */
    public function translationCopyEditorCredits(): BelongsToMany
    {
        return $this->creditsAs(CreditRole::TRANSLATION_COPY_EDITOR);
    }

    /**
     * Get the glossary spellings linked to this item translation.
     *
     * @return BelongsToMany<GlossarySpelling, $this>
     */
    public function spellings(): BelongsToMany
    {
        return $this->belongsToMany(GlossarySpelling::class, 'item_translation_spelling', 'item_translation_id', 'spelling_id')
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
     * Get sibling translations (other translations of the same item).
     *
     * @return HasMany<ItemTranslation, $this>
     */
    public function siblingTranslations(): HasMany
    {
        return $this->hasMany(self::class, 'item_id', 'item_id');
    }
}
