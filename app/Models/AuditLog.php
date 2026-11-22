<?php

namespace App\Models;

use App\Support\Audit\AuditLogger;
use Database\Factories\AuditLogFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * One account change, written by {@see AuditLogger}.
 * Entries are only ever added: updating or deleting one throws.
 *
 * @property string $id
 * @property Carbon $occurred_at
 * @property int|null $actor_id
 * @property string $actor_label
 * @property string $channel
 * @property string $action
 * @property string|null $subject_type
 * @property string|null $subject_id
 * @property string|null $subject_label
 * @property array<string, mixed>|null $changes
 * @property string|null $ip_address
 */
class AuditLog extends Model
{
    /** @use HasFactory<AuditLogFactory> */
    use HasFactory;

    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'occurred_at',
        'actor_id',
        'actor_label',
        'channel',
        'action',
        'subject_type',
        'subject_id',
        'subject_label',
        'changes',
        'ip_address',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'changes' => 'array',
    ];

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new LogicException('Audit log entries cannot be changed.');
        });

        static::deleting(function (): never {
            throw new LogicException('Audit log entries cannot be deleted.');
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
