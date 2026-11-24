<?php

namespace App\Models;

use App\Enums\CreditRole;
use Database\Factories\AuthorFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Author Model
 *
 * Represents authors who write text content in the system.
 */
class Author extends Model
{
    /** @use HasFactory<AuthorFactory> */
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'name',
        'firstname',
        'lastname',
        'givenname',
        'originalname',
        'internal_name',
        'backward_compatibility',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the columns that should receive a unique identifier.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * Accessor to ensure null values instead of empty strings
     */
    public function getInternalNameAttribute(?string $value): ?string
    {
        return $value === '' ? null : $value;
    }

    /**
     * Mutator to ensure null values instead of empty strings
     */
    public function setInternalNameAttribute(mixed $value): void
    {
        $this->attributes['internal_name'] = $value === '' ? null : $value;
    }

    /**
     * Accessor to ensure null values instead of empty strings
     */
    public function getBackwardCompatibilityAttribute(?string $value): ?string
    {
        return $value === '' ? null : $value;
    }

    /**
     * Mutator to ensure null values instead of empty strings
     */
    public function setBackwardCompatibilityAttribute(mixed $value): void
    {
        $this->attributes['backward_compatibility'] = $value === '' ? null : $value;
    }

    /**
     * Get the translations for this author.
     *
     * @return HasMany<AuthorTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(AuthorTranslation::class);
    }

    /**
     * Get the item translations crediting this person in one role: the way
     * back from ItemTranslation::creditsAs(), which the panel's Attach action
     * uses to leave out the people already credited in that role.
     *
     * @return BelongsToMany<ItemTranslation, $this, ItemTranslationAuthor>
     */
    public function itemTranslationsCreditedAs(CreditRole $role): BelongsToMany
    {
        return $this->belongsToMany(ItemTranslation::class, 'item_translation_author')
            ->using(ItemTranslationAuthor::class)
            ->withPivot('role', 'display_order')
            ->withPivotValue('role', $role->value)
            ->withTimestamps();
    }

    /** @return BelongsToMany<ItemTranslation, $this, ItemTranslationAuthor> */
    public function itemTranslationsCreditedAsAuthor(): BelongsToMany
    {
        return $this->itemTranslationsCreditedAs(CreditRole::AUTHOR);
    }

    /** @return BelongsToMany<ItemTranslation, $this, ItemTranslationAuthor> */
    public function itemTranslationsCreditedAsTextCopyEditor(): BelongsToMany
    {
        return $this->itemTranslationsCreditedAs(CreditRole::TEXT_COPY_EDITOR);
    }

    /** @return BelongsToMany<ItemTranslation, $this, ItemTranslationAuthor> */
    public function itemTranslationsCreditedAsTranslator(): BelongsToMany
    {
        return $this->itemTranslationsCreditedAs(CreditRole::TRANSLATOR);
    }

    /** @return BelongsToMany<ItemTranslation, $this, ItemTranslationAuthor> */
    public function itemTranslationsCreditedAsTranslationCopyEditor(): BelongsToMany
    {
        return $this->itemTranslationsCreditedAs(CreditRole::TRANSLATION_COPY_EDITOR);
    }
}
