<?php

namespace Database\Factories;

use App\Enums\LinkType;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Link;
use App\Models\Partner;
use App\Models\PublicationEdition;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<Link>
 */
class LinkFactory extends Factory
{
    protected $model = Link::class;

    /**
     * Define the model's default state: a video link of a new item.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => $this->faker->unique()->uuid(),
            'linkable_type' => 'item',
            'linkable_id' => Item::factory(),
            'language_id' => null,
            'type' => LinkType::VIDEO,
            'title' => $this->faker->sentence(4),
            'url' => 'https://www.youtube.com/watch?v='.$this->faker->regexify('[a-zA-Z0-9_-]{11}'),
            'description' => $this->faker->optional(0.5)->paragraph(),
            'authors' => null,
            'display_order' => $this->faker->numberBetween(1, 10),
            'extra' => null,
            'backward_compatibility' => null,
        ];
    }

    /**
     * A link of this owner.
     */
    public function ownedBy(Model $owner): static
    {
        return $this->state(fn (): array => [
            'linkable_type' => $owner->getMorphClass(),
            'linkable_id' => $owner->getKey(),
        ]);
    }

    /**
     * A link of this type.
     */
    public function ofType(LinkType $type): static
    {
        return $this->state(fn (): array => ['type' => $type]);
    }

    /**
     * A collection's document link.
     */
    public function forCollection(?Collection $collection = null): static
    {
        return $this->ownedBy($collection ?? Collection::factory()->create())->ofType(LinkType::DOCUMENT);
    }

    /**
     * A partner's website.
     */
    public function forPartner(?Partner $partner = null): static
    {
        return $this->ownedBy($partner ?? Partner::factory()->create())->ofType(LinkType::WEBSITE);
    }

    /**
     * A publication edition's shop link.
     */
    public function forEdition(?PublicationEdition $edition = null): static
    {
        return $this->ownedBy($edition ?? PublicationEdition::factory()->create())->ofType(LinkType::SHOP);
    }
}
