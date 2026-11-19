<?php

namespace App\Models;

use Database\Factories\VisitInformationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Visit information (M16 D1, #2645): how to reach a place, its opening hours,
 * contact, address, institution, practical information, phone, fax, e-mail
 * and website, in one language and context, as written.
 *
 * It belongs to exactly one owner: an item (a monument), a collection (a
 * travel location) or a partner.
 *
 * @property string $id
 * @property string|null $item_id
 * @property string|null $collection_id
 * @property string|null $partner_id
 * @property string $language_id
 * @property string $context_id
 * @property string|null $how_to_reach
 * @property string|null $opening_hours
 * @property string|null $contact
 * @property string|null $address
 * @property string|null $institution
 * @property string|null $practical_information
 * @property string|null $phone
 * @property string|null $fax
 * @property string|null $email
 * @property string|null $website
 * @property string|null $backward_compatibility
 * @property object|null $extra
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class VisitInformation extends Model
{
    /** @use HasFactory<VisitInformationFactory> */
    use HasFactory, HasUuids;

    /** The owner columns: exactly one is set. */
    public const OWNER_COLUMNS = ['item_id', 'collection_id', 'partner_id'];

    /** The text fields, in the order the panel and the API show them. */
    public const TEXT_FIELDS = [
        'how_to_reach',
        'opening_hours',
        'contact',
        'address',
        'institution',
        'practical_information',
        'phone',
        'fax',
        'email',
        'website',
    ];

    /**
     * @var string
     */
    protected $table = 'visit_information';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'item_id',
        'collection_id',
        'partner_id',
        'language_id',
        'context_id',
        'how_to_reach',
        'opening_hours',
        'contact',
        'address',
        'institution',
        'practical_information',
        'phone',
        'fax',
        'email',
        'website',
        'backward_compatibility',
        'extra',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'extra' => 'object',
    ];

    protected static function booted(): void
    {
        static::saving(function (VisitInformation $visitInformation): void {
            $owners = array_filter(
                self::OWNER_COLUMNS,
                fn (string $column): bool => $visitInformation->getAttribute($column) !== null
            );
            if (count($owners) !== 1) {
                throw new InvalidArgumentException('Visit information belongs to exactly one item, collection or partner.');
            }
        });
    }

    /**
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * @return BelongsTo<Collection, $this>
     */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /**
     * @return BelongsTo<Partner, $this>
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
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
}
