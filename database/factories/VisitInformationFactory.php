<?php

namespace Database\Factories;

use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\VisitInformation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VisitInformation>
 */
class VisitInformationFactory extends Factory
{
    /**
     * A monument's visit information, by default.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'item_id' => Item::factory()->Monument(),
            'collection_id' => null,
            'partner_id' => null,
            'language_id' => Language::factory(),
            'context_id' => Context::factory(),
            'how_to_reach' => $this->faker->optional()->sentence(10),
            'opening_hours' => $this->faker->optional()->sentence(6),
            'contact' => $this->faker->optional()->sentence(4),
            'address' => $this->faker->optional()->address(),
            'institution' => $this->faker->optional()->company(),
            'practical_information' => $this->faker->optional()->paragraph(),
            'phone' => $this->faker->optional()->phoneNumber(),
            'fax' => null,
            'email' => $this->faker->optional()->safeEmail(),
            'website' => $this->faker->optional()->url(),
            'backward_compatibility' => null,
            'extra' => null,
        ];
    }

    public function forItem(Item $item): static
    {
        return $this->state(fn (array $attributes): array => [
            'item_id' => $item->id,
            'collection_id' => null,
            'partner_id' => null,
        ]);
    }

    public function forCollection(Collection $collection): static
    {
        return $this->state(fn (array $attributes): array => [
            'item_id' => null,
            'collection_id' => $collection->id,
            'partner_id' => null,
        ]);
    }

    public function forPartner(Partner $partner): static
    {
        return $this->state(fn (array $attributes): array => [
            'item_id' => null,
            'collection_id' => null,
            'partner_id' => $partner->id,
        ]);
    }
}
