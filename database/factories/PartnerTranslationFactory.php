<?php

namespace Database\Factories;

use App\Models\Context;
use App\Models\Language;
use App\Models\Partner;
use App\Models\PartnerTranslation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PartnerTranslation>
 */
class PartnerTranslationFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = PartnerTranslation::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'partner_id' => Partner::factory(),
            'language_id' => Language::factory(),
            'context_id' => Context::factory(),
            'name' => $this->faker->company(),
            'description' => $this->faker->optional()->paragraphs(2, true),
            // Address fields (embedded)
            'city_display' => $this->faker->optional()->city(),
            'address_line_1' => $this->faker->optional()->streetAddress(),
            'address_line_2' => $this->faker->optional()->secondaryAddress(),
            'postal_code' => $this->faker->optional()->postcode(),
            'address_notes' => $this->faker->optional()->sentence(),
            // Contact fields (semi-structured)
            'contact_name' => $this->faker->optional()->name(),
            'contact_email_general' => $this->faker->optional()->companyEmail(),
            'contact_email_press' => $this->faker->optional()->companyEmail(),
            'contact_phone' => $this->faker->optional()->phoneNumber(),
            'contact_fax' => $this->faker->optional()->phoneNumber(),
            'contact_website' => $this->faker->optional()->url(),
            'contact_notes' => $this->faker->optional()->sentence(),
            'contact_emails' => $this->faker->optional(0.3)->passthrough([
                $this->faker->companyEmail(),
                $this->faker->companyEmail(),
            ]),
            'contact_phones' => $this->faker->optional(0.3)->passthrough([
                $this->faker->phoneNumber(),
                $this->faker->phoneNumber(),
            ]),
            // Metadata
            'backward_compatibility' => $this->faker->optional()->bothify('???_##'),
            'extra' => $this->faker->optional()->passthrough(['key' => 'value']),
        ];
    }

    /**
     * Create a translation with default context.
     */
    public function defaultContext(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'context_id' => Context::factory()->default(),
            ];
        });
    }

    /**
     * Create a translation with default context.
     */
    public function withDefaultContext(): static
    {
        return $this->state(function (array $attributes) {
            $defaultContext = Context::default()->first();

            return [
                'context_id' => $defaultContext ? $defaultContext->id : Context::factory()->default(),
            ];
        });
    }

    /**
     * Create a translation with specific language.
     */
    public function forLanguage(string $languageId): static
    {
        return $this->state(function (array $attributes) use ($languageId) {
            return [
                'language_id' => $languageId,
            ];
        });
    }

    /**
     * Create a translation with specific context.
     */
    public function forContext(string $contextId): static
    {
        return $this->state(function (array $attributes) use ($contextId) {
            return [
                'context_id' => $contextId,
            ];
        });
    }

    /**
     * Create a translation for a specific partner.
     */
    public function forPartner(string $partnerId): static
    {
        return $this->state(function (array $attributes) use ($partnerId) {
            return [
                'partner_id' => $partnerId,
            ];
        });
    }

    /**
     * Create a translation with full address information.
     */
    public function withFullAddress(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'city_display' => $this->faker->city(),
                'address_line_1' => $this->faker->streetAddress(),
                'address_line_2' => $this->faker->secondaryAddress(),
                'postal_code' => $this->faker->postcode(),
                'address_notes' => $this->faker->sentence(),
            ];
        });
    }

    /**
     * Create a translation with full contact information.
     */
    public function withFullContact(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'contact_name' => $this->faker->name(),
                'contact_email_general' => $this->faker->companyEmail(),
                'contact_email_press' => $this->faker->companyEmail(),
                'contact_phone' => $this->faker->phoneNumber(),
                'contact_fax' => $this->faker->phoneNumber(),
                'contact_website' => $this->faker->url(),
                'contact_notes' => $this->faker->sentence(),
                'contact_emails' => json_encode([
                    $this->faker->companyEmail(),
                    $this->faker->companyEmail(),
                ]),
                'contact_phones' => json_encode([
                    $this->faker->phoneNumber(),
                    $this->faker->phoneNumber(),
                ]),
            ];
        });
    }

    /**
     * Create a museum translation.
     */
    public function museum(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'name' => $this->faker->company().' Museum',
                'description' => 'A prestigious museum dedicated to preserving cultural heritage.',
            ];
        });
    }

    /**
     * Create an institution translation.
     */
    public function institution(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'name' => $this->faker->company().' Institute',
                'description' => 'An institution focused on research and cultural preservation.',
            ];
        });
    }
}
