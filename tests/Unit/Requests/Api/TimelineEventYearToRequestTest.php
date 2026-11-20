<?php

namespace Tests\Unit\Requests\Api;

use App\Http\Requests\Api\StoreTimelineEventRequest;
use App\Http\Requests\Api\UpdateTimelineEventRequest;
use App\Models\Timeline;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * A timeline event may have no end year (M16 G2, #2697).
 */
class TimelineEventYearToRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_accepts_an_event_without_an_end_year(): void
    {
        $timeline = Timeline::factory()->create();
        $rules = (new StoreTimelineEventRequest)->rules();

        $this->assertTrue(Validator::make([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Open-ended event',
            'year_from' => 1701,
        ], $rules)->passes());

        $this->assertTrue(Validator::make([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Open-ended event',
            'year_from' => 1701,
            'year_to' => null,
        ], $rules)->passes());
    }

    public function test_store_still_rejects_an_end_year_that_is_not_a_whole_number(): void
    {
        $timeline = Timeline::factory()->create();

        $validator = Validator::make([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Event',
            'year_from' => 1701,
            'year_to' => 'later',
        ], (new StoreTimelineEventRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('year_to'));
    }

    public function test_update_can_clear_the_end_year(): void
    {
        $this->assertTrue(Validator::make(
            ['year_to' => null],
            (new UpdateTimelineEventRequest)->rules()
        )->passes());
    }
}
