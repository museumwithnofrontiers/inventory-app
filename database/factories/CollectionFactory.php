<?php

namespace Database\Factories;

use App\Enums\PartnerLevel;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Country;
use App\Models\Language;
use App\Models\Partner;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Collection>
 */
class CollectionFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = Collection::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'internal_name' => $this->faker->unique()->slug(2),
            'type' => $this->faker->randomElement(['collection', 'exhibition', 'gallery', 'theme', 'exhibition trail', 'itinerary', 'location', 'subtheme', 'region']),
            // Functional purpose (nullable by default; null is the norm)
            'purpose' => null,
            'language_id' => Language::factory(),
            'context_id' => Context::factory(),
            'parent_id' => null,
            'display_order' => null,
            'backward_compatibility' => $this->faker->optional()->uuid(),
            // Collection-level structured attributes (nullable by default)
            'extra' => null,
            // GPS Location (nullable by default)
            'latitude' => null,
            'longitude' => null,
            'map_zoom' => null,
            // Country reference (nullable by default)
            'country_id' => null,
            // Cover picture and days (nullable by default)
            'cover_item_id' => null,
            'days' => null,
            // Editorial flags
            'draft' => false,
        ];
    }

    /**
     * Configure the factory to use an existing language.
     */
    public function withLanguage(string $languageId): Factory
    {
        return $this->state(fn (array $attributes) => [
            'language_id' => $languageId,
        ]);
    }

    /**
     * Configure the factory to use an existing context.
     */
    public function withContext(string $contextId): Factory
    {
        return $this->state(fn (array $attributes) => [
            'context_id' => $contextId,
        ]);
    }

    /**
     * Configure the factory to use the default language.
     */
    public function withDefaultLanguage(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'language_id' => Language::where('is_default', true)->first()?->id ?? 'eng',
        ]);
    }

    /**
     * Configure the factory to use the default context.
     */
    public function withDefaultContext(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'context_id' => Context::where('is_default', true)->first()?->id,
        ]);
    }

    /**
     * Configure the factory to create a collection with partners.
     */
    public function hasPartners(int $count = 1): Factory
    {
        return $this->afterCreating(function (Collection $collection) use ($count) {
            $partners = Partner::factory()->count($count)->create();
            foreach ($partners as $partner) {
                $collection->partners()->attach($partner->id, [
                    'collection_type' => 'collection',
                    'level' => PartnerLevel::PARTNER->value,
                ]);
            }
        });
    }

    /**
     * Create a collection of type 'collection'.
     */
    public function collection(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'collection',
        ]);
    }

    /**
     * Create a collection of type 'exhibition'.
     */
    public function exhibition(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'exhibition',
        ]);
    }

    /**
     * Create a collection of type 'gallery'.
     */
    public function gallery(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'gallery',
        ]);
    }

    /**
     * Create a collection of type 'theme'.
     */
    public function theme(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'theme',
        ]);
    }

    /**
     * Create a collection of type 'exhibition trail'.
     */
    public function exhibitionTrail(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'exhibition trail',
        ]);
    }

    /**
     * Create a collection of type 'itinerary'.
     */
    public function itinerary(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'itinerary',
        ]);
    }

    /**
     * Create a collection of type 'location'.
     */
    public function location(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'location',
        ]);
    }

    /**
     * Create a collection of type 'subtheme'.
     */
    public function subtheme(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'subtheme',
        ]);
    }

    /**
     * Create a collection of type 'region'.
     */
    public function region(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'region',
        ]);
    }

    /**
     * Configure the factory with a functional purpose (see Collection::PURPOSES).
     */
    public function withPurpose(string $purpose): Factory
    {
        return $this->state(fn (array $attributes) => [
            'purpose' => $purpose,
        ]);
    }

    /**
     * Configure the factory with collection-level structured attributes.
     *
     * @param  array<string, mixed>  $extra
     */
    public function withExtra(array $extra): Factory
    {
        return $this->state(fn (array $attributes) => [
            'extra' => $extra,
        ]);
    }

    /**
     * Configure the factory to use an existing parent collection.
     */
    public function withParent(string $parentId): Factory
    {
        return $this->state(fn (array $attributes) => [
            'parent_id' => $parentId,
        ]);
    }

    /**
     * Configure the factory to create a child collection.
     */
    public function asChild(): Factory
    {
        return $this->afterMaking(function (Collection $collection) {
            if (! $collection->parent_id) {
                $parent = Collection::factory()->create();
                $collection->parent_id = $parent->id;
            }
        });
    }

    /**
     * Configure the factory to use an existing country.
     */
    public function withCountry(string $countryId): Factory
    {
        return $this->state(fn (array $attributes) => [
            'country_id' => $countryId,
        ]);
    }

    /**
     * Configure the factory to create a collection with a random country.
     */
    public function withRandomCountry(): Factory
    {
        return $this->state(fn (array $attributes) => [
            'country_id' => Country::factory(),
        ]);
    }

    /**
     * Configure the factory with geocoordinates.
     */
    public function withGeocoordinates(?float $latitude = null, ?float $longitude = null, ?int $mapZoom = null): Factory
    {
        return $this->state(fn (array $attributes) => [
            'latitude' => $latitude ?? $this->faker->latitude(),
            'longitude' => $longitude ?? $this->faker->longitude(),
            'map_zoom' => $mapZoom ?? $this->faker->numberBetween(1, 20),
        ]);
    }

    /**
     * Configure the factory with random geocoordinates.
     */
    public function withRandomGeocoordinates(): Factory
    {
        return $this->withGeocoordinates();
    }
}
