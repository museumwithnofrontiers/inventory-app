<?php

namespace App\Models;

use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $internal_name
 * @property string|null $backward_compatibility
 * @property Carbon|null $launch_date
 * @property string|null $site_url
 * @property string|null $related_database_url
 * @property string|null $artistic_introduction_url
 * @property string|null $copyright
 * @property string|null $context_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory;

    use HasUuids;

    // No model-level eager loads. Use request-scoped includes in controllers.

    protected $fillable = [
        // 'id',
        'internal_name',
        'backward_compatibility',
        // The date MWNF started the work (M17, #2748): a fact, never a go-live gate.
        'launch_date',
        'site_url',
        'related_database_url',
        'artistic_introduction_url',
        'copyright',
        'context_id',
        'language_id',
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
     * The context associated with the Project.
     *
     * @return BelongsTo<Context, $this>
     */
    public function context(): BelongsTo
    {
        return $this->belongsTo(Context::class, 'context_id');
    }

    /**
     * The language associated with the Project.
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class, 'language_id');
    }

    /**
     * The project's name in each language.
     *
     * @return HasMany<ProjectTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(ProjectTranslation::class);
    }

    /**
     * Get the items associated with the Project.
     *
     * @return HasMany<Item, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(Item::class);
    }

    /**
     * Get the partners associated with the Project.
     *
     * @return HasMany<Partner, $this>
     */
    public function partners(): HasMany
    {
        return $this->hasMany(Partner::class);
    }

    /**
     * Get the collections associated with the Project through its items.
     *
     * @return BelongsToMany<Collection, $this>
     */
    public function collections(): BelongsToMany
    {
        return $this->belongsToMany(Collection::class, 'items', 'project_id', 'collection_id')
            ->whereNotNull('items.collection_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected $casts = [
        'launch_date' => 'datetime:Y-m-d',
    ];
}
