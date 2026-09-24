<?php

namespace Database\Factories;

use App\Models\TimelineEvent;
use App\Models\TimelineEventImage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TimelineEventImage>
 */
class TimelineEventImageFactory extends Factory
{
    protected $model = TimelineEventImage::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => $this->faker->unique()->uuid(),
            'timeline_event_id' => TimelineEvent::factory(),
            'path' => $this->faker->slug(2).'.jpg',
            'original_name' => $this->faker->slug(2).'.jpg',
            'mime_type' => 'image/jpeg',
            'size' => $this->faker->numberBetween(1000, 5000000),
            'alt_text' => $this->faker->optional(0.5)->sentence(3),
            'copyright' => null,
            'display_order' => $this->faker->numberBetween(1, 10),
        ];
    }
}
