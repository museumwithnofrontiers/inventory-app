<?php

namespace App\Models;

use App\Traits\HasJsonFields;
use Database\Factories\PartnerTranslationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * PartnerTranslation Model
 *
 * Represents language and context-specific translations for Partners.
 * Contains translated partner information, addresses, and contact details.
 *
 * @property string $partner_id
 * @property string $language_id
 * @property string $context_id
 * @property string|null $name
 * @property string|null $description
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PartnerTranslation extends Model
{
    /** @use HasFactory<PartnerTranslationFactory> */
    use HasFactory, HasJsonFields, HasUuids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'partner_translations';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'partner_id',
        'language_id',
        'context_id',
        'name',
        'description',
        // Address fields (embedded)
        'city_display',
        'address_line_1',
        'address_line_2',
        'postal_code',
        'address_notes',
        // Contact fields (semi-structured)
        'contact_name',
        'contact_email_general',
        'contact_email_press',
        'contact_phone',
        'contact_fax',
        'contact_website',
        'contact_notes',
        'contact_emails',
        'contact_phones',
        // Metadata
        'backward_compatibility',
        'extra',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'contact_emails' => 'array',
        'contact_phones' => 'array',
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
     * Delete the model from the database.
     * Ensures atomic deletion of the PartnerTranslation and its images.
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

        // Fire the deleting event
        if ($this->fireModelEvent('deleting') === false) {
            return false;
        }

        // Perform atomic deletion in a transaction
        return DB::transaction(function () {
            // Delete all partner translation images
            $this->partnerTranslationImages()->delete();

            // Then perform the actual deletion
            $this->performDeleteOnModel();

            // Mark the model as non-existing
            $this->exists = false;

            // Fire the deleted event
            $this->fireModelEvent('deleted', false);

            return true;
        });
    }

    /** @return BelongsTo<Partner, $this> */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
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
     * Get the images for this partner translation.
     *
     * @return HasMany<PartnerTranslationImage, $this>
     */
    public function partnerTranslationImages(): HasMany
    {
        return $this->hasMany(PartnerTranslationImage::class)->orderBy('display_order');
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
     * Get sibling translations (other translations of the same partner).
     *
     * @return HasMany<PartnerTranslation, $this>
     */
    public function siblingTranslations(): HasMany
    {
        return $this->hasMany(self::class, 'partner_id', 'partner_id');
    }
}
