<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\TimelineEventResource\Pages\ListTimelineEvent;
use App\Filament\Resources\TimelineResource\Pages\ListTimeline;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class TimelineSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_timeline_resource_handles_a_large_dataset(): void
    {
        $user = $this->createViewOnlyUser();
        $this->seedTimelines(100);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/timelines');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Timeline::query()
            ->orderBy('internal_name')
            ->limit(10)
            ->get();

        $target = Timeline::query()->where('internal_name', 'Timeline 099')->firstOrFail();
        $nonTarget = Timeline::query()->where('internal_name', 'Timeline 000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListTimeline::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->searchTable('Timeline 099')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget]);
    }

    public function test_timeline_event_resource_handles_a_large_dataset(): void
    {
        $user = $this->createViewOnlyUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Bulk Timeline']);
        $this->seedTimelineEvents($timeline->id, 100);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/timeline-events');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $target = TimelineEvent::query()->where('internal_name', 'Event 099')->firstOrFail();
        $nonTarget = TimelineEvent::query()->where('internal_name', 'Event 000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListTimelineEvent::class)
            ->searchTable('Event 099')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget]);
    }

    protected function seedTimelines(int $count): void
    {
        $timestamp = Carbon::now();

        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'internal_name' => sprintf('Timeline %03d', $i),
                'country_id' => null,
                'collection_id' => null,
                'backward_compatibility' => null,
                'extra' => null,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            Timeline::query()->insert($chunk);
        }
    }

    protected function seedTimelineEvents(string $timelineId, int $count): void
    {
        $timestamp = Carbon::now();

        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'timeline_id' => $timelineId,
                'internal_name' => sprintf('Event %03d', $i),
                'year_from' => 600 + $i,
                'year_to' => 700 + $i,
                'year_from_ah' => null,
                'year_to_ah' => null,
                'date_from' => null,
                'date_to' => null,
                'display_order' => $i,
                'backward_compatibility' => null,
                'extra' => null,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            TimelineEvent::query()->insert($chunk);
        }
    }
}
