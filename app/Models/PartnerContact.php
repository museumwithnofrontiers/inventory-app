<?php

namespace App\Models;

use Database\Factories\PartnerContactFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A partner's contact person (M16 D2, #2646): name, title, e-mail, phone and
 * fax, every field as written, in legacy's order (`display_order`).
 *
 * @property string $id
 * @property string $partner_id
 * @property int $display_order
 * @property string|null $name
 * @property string|null $title
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $fax
 * @property string|null $backward_compatibility
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PartnerContact extends Model
{
    /** @use HasFactory<PartnerContactFactory> */
    use HasFactory, HasUuids;

    /** The text fields, in the order the panel and the API show them. */
    public const TEXT_FIELDS = ['name', 'title', 'email', 'phone', 'fax'];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'partner_id',
        'display_order',
        'name',
        'title',
        'email',
        'phone',
        'fax',
        'backward_compatibility',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'display_order' => 'integer',
    ];

    /**
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * @return BelongsTo<Partner, $this>
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }
}
