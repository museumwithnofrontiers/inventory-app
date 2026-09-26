<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ItemTranslationResource\Pages\EditItemTranslation;
use App\Filament\Resources\TimelineEventResource\Pages\CreateTimelineEvent;
use App\Filament\Resources\TimelineEventResource\Pages\EditTimelineEvent;
use App\Filament\Resources\TimelineResource\Pages\CreateTimeline;
use App\Filament\Resources\TimelineResource\Pages\EditTimeline;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Tests for the `extra` JSON field in Filament resources and relation managers.
 *
 * Covers:
 *  - Timeline (top-level model with `extra`)
 *  - TimelineEvent (top-level model with `extra`)
 *  - ItemTranslation (translation model with `extra`)
 */
class ExtraJsonFieldTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ─── Timeline ────────────────────────────────────────────────────────────────

    public function test_timeline_create_form_accepts_valid_json_extra(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTimeline::class)
            ->fillForm([
                'internal_name' => 'Islamic Heritage Timeline',
                'extra' => '{"source": "MWNF", "verified": true}',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $timeline = Timeline::where('internal_name', 'Islamic Heritage Timeline')->first();
        $this->assertNotNull($timeline);
        $extra = json_decode(json_encode($timeline->extra), true);
        $this->assertArrayHasKey('source', $extra);
        $this->assertSame('MWNF', $extra['source']);
        $this->assertTrue($extra['verified']);
    }

    public function test_timeline_create_form_accepts_nested_json_extra(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTimeline::class)
            ->fillForm([
                'internal_name' => 'Nested JSON Timeline',
                'extra' => '{"meta": {"region": "MENA", "tags": ["art", "history"]}}',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $timeline = Timeline::where('internal_name', 'Nested JSON Timeline')->first();
        $this->assertNotNull($timeline);
        $extra = json_decode(json_encode($timeline->extra), true);
        $this->assertArrayHasKey('meta', $extra);
        $meta = $extra['meta'];
        $this->assertSame('MENA', $meta['region']);
    }

    public function test_timeline_create_form_rejects_invalid_json_extra(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTimeline::class)
            ->fillForm([
                'internal_name' => 'Bad JSON Timeline',
                'extra' => '{invalid json}',
            ])
            ->call('create')
            ->assertHasFormErrors(['extra']);
    }

    public function test_timeline_create_form_accepts_empty_extra(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTimeline::class)
            ->fillForm([
                'internal_name' => 'No Extra Timeline',
                'extra' => '',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('timelines', [
            'internal_name' => 'No Extra Timeline',
            'extra' => null,
        ]);
    }

    public function test_timeline_edit_form_hydrates_extra_as_json_string(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create([
            'internal_name' => 'Timeline With Extra',
            'extra' => ['key' => 'value', 'nested' => ['a' => 1]],
        ]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(EditTimeline::class, ['record' => $timeline->getRouteKey()]);

        $formState = $component->get('data.extra');
        $this->assertIsString($formState);
        $decoded = json_decode($formState, true);
        $this->assertIsArray($decoded);
        $this->assertArrayHasKey('key', $decoded);
        $this->assertSame('value', $decoded['key']);
    }

    public function test_timeline_view_page_renders_extra_section(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create([
            'internal_name' => 'Timeline With Metadata',
            'extra' => ['curator' => 'Dr. Smith'],
        ]);

        $this->actingAs($user)
            ->get("/admin/timelines/{$timeline->getKey()}")
            ->assertOk()
            ->assertSee('Metadata')
            ->assertSee('text-gray-950', false);
    }

    // ─── TimelineEvent ───────────────────────────────────────────────────────────

    public function test_timeline_event_create_form_accepts_valid_json_extra(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTimelineEvent::class)
            ->fillForm([
                'timeline_id' => $timeline->id,
                'internal_name' => 'Medieval Event',
                'year_from' => 700,
                'year_to' => 1000,
                'display_order' => 1,
                'extra' => '{"period": "medieval", "confidence": "high"}',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $event = TimelineEvent::where('internal_name', 'Medieval Event')->first();
        $this->assertNotNull($event);
        $extra = json_decode(json_encode($event->extra), true);
        $this->assertArrayHasKey('period', $extra);
        $this->assertSame('medieval', $extra['period']);
    }

    public function test_timeline_event_create_form_rejects_invalid_json_extra(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTimelineEvent::class)
            ->fillForm([
                'timeline_id' => $timeline->id,
                'internal_name' => 'Bad JSON Event',
                'extra' => 'not json at all',
            ])
            ->call('create')
            ->assertHasFormErrors(['extra']);
    }

    public function test_timeline_event_edit_form_hydrates_extra_as_json_string(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Event With Extra',
            'extra' => ['type' => 'battle', 'casualties' => 500],
        ]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(EditTimelineEvent::class, ['record' => $event->getRouteKey()]);

        $formState = $component->get('data.extra');
        $this->assertIsString($formState);
        $decoded = json_decode($formState, true);
        $this->assertIsArray($decoded);
        $this->assertArrayHasKey('type', $decoded);
        $this->assertSame('battle', $decoded['type']);
    }

    public function test_timeline_event_view_page_renders_metadata_section(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Event With Metadata',
            'extra' => ['note' => 'important event'],
        ]);

        $this->actingAs($user)
            ->get("/admin/timeline-events/{$event->getKey()}")
            ->assertOk()
            ->assertSee('Metadata');
    }

    // ─── ItemTranslation ────────────────────────────────────────────────────────

    public function test_item_translation_edit_form_accepts_json_string_extra(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple Relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
            'extra' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->fillForm([
                'extra' => '{"notice_b": "Additional notice text", "linkcatalogs": ["http://example.com"]}',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $translation->refresh();
        $extra = (array) $translation->extra;
        $this->assertArrayHasKey('notice_b', $extra);
        $this->assertSame('Additional notice text', $extra['notice_b']);
        $this->assertArrayHasKey('linkcatalogs', $extra);
    }

    public function test_item_translation_edit_form_rejects_invalid_json_extra(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple Relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->fillForm([
                'extra' => '{bad json: "no quotes on key"}',
            ])
            ->call('save')
            ->assertHasFormErrors(['extra']);
    }

    public function test_item_translation_edit_form_hydrates_existing_extra_as_json_string(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple Relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
            'extra' => ['notice_b' => 'Some notice', 'nested' => ['level' => 2]],
        ]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()]);

        $formState = $component->get('data.extra');
        $this->assertIsString($formState);

        $decoded = json_decode($formState, true);
        $this->assertIsArray($decoded);
        $this->assertArrayHasKey('notice_b', $decoded);
        $this->assertSame('Some notice', $decoded['notice_b']);
        // Nested arrays must survive the round-trip without being flattened to a string
        $this->assertIsArray($decoded['nested']);
        $this->assertSame(2, $decoded['nested']['level']);
    }

    public function test_item_translation_view_page_shows_extra_in_extra_data_section(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple Relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
            'extra' => ['notice_b' => 'A public notice'],
        ]);

        $this->actingAs($user)
            ->get("/admin/item-translations/{$translation->getKey()}")
            ->assertOk()
            ->assertSee('Extra Data');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────
}
