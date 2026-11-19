<?php

namespace App\Traits;

use App\Models\Link;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * An owner of Links (M16 F3). A link has no foreign key to its owner (it is
 * polymorphic), so deleting the owner through Eloquent deletes its links.
 *
 * @mixin Model
 */
trait HasLinks
{
    protected static function bootHasLinks(): void
    {
        static::deleting(function (Model $owner): void {
            /** @var Model&self $owner */
            $owner->links()->delete();
        });
    }

    /**
     * The links of this record, by type and display order.
     *
     * @return MorphMany<Link, $this>
     */
    public function links(): MorphMany
    {
        return $this->morphMany(Link::class, 'linkable')->orderBy('type')->orderBy('display_order');
    }
}
