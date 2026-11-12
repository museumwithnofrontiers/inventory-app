<?php

namespace App\Models;

use Database\Factories\PublicationTranslationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A publication's text in one language and context. The three credit fields
 * hold the lines as printed; they are never split into Author records.
 *
 * @property string $id
 * @property string $publication_id
 * @property string $language_id
 * @property string $context_id
 * @property string $title
 * @property string|null $subtitle
 * @property string|null $description
 * @property string|null $introduction
 * @property string|null $author_credit
 * @property string|null $photography_credit
 * @property string|null $coordination_credit
 * @property string|null $backward_compatibility
 * @property object|null $extra
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PublicationTranslation extends Model
{
    /** @use HasFactory<PublicationTranslationFactory> */
    use HasFactory, HasUuids;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'publication_id',
        'language_id',
        'context_id',
        'title',
        'subtitle',
        'description',
        'introduction',
        'author_credit',
        'photography_credit',
        'coordination_credit',
        'backward_compatibility',
        'extra',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
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
     * @return BelongsTo<Context, $this>
     */
    public function context(): BelongsTo
    {
        return $this->belongsTo(Context::class);
    }

    /**
     * Every translation of the same publication (the sibling translations
     * manager leaves this one out).
     *
     * @return HasMany<PublicationTranslation, $this>
     */
    public function siblingTranslations(): HasMany
    {
        return $this->hasMany(self::class, 'publication_id', 'publication_id');
    }
}
