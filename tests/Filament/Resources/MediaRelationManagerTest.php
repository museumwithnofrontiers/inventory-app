<?php

namespace Tests\Filament\Resources;

use App\Enums\MediaType;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\MediaRelationManager;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A4.4 (#1908): MediaRelationManager keeps its inline Create/Edit
 * (no Resource exists for Media), gains `language` and `extra` fields, and
 * closes the view-only mutation gap #1864 flagged (AuthorizesRelationMutations,
 * added in A0.1, already gates the built-in Create/Edit/Delete actions here —
 * these tests are the story's own verification of that, mounted on ViewItem
 * where AuthorizesRelationMutations also makes the manager editable, per A0.6).
 */
class MediaRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_media_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertSuccessful();
    }

    // ── Authorization: view-only user sees no mutating action ──────────────

    public function test_view_only_user_sees_no_mutating_action(): void
    {
        $viewer = $this->createViewOnlyUser();
        $item = Item::factory()->Object()->create();
        $media = ItemMedia::factory()->forItem($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $media)
            ->assertTableActionHidden('delete', $media);
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $media = ItemMedia::factory()->forItem($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $media)
            ->assertTableActionVisible('delete', $media);
    }

    // ── Create ───────────────────────────────────────────────────────────────

    public function test_crud_user_creates_a_media_row_with_language_and_extra(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'type' => MediaType::VIDEO->value,
                'url' => 'https://www.youtube.com/watch?v=abc123',
                'title' => 'Conservation video',
                'language' => $language->id,
                'extra' => json_encode(['source' => 'youtube']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $media = ItemMedia::where('item_id', $item->id)->first();
        $this->assertNotNull($media);
        $this->assertSame('Conservation video', $media->title);
        $this->assertSame($language->id, $media->language_id);
        $this->assertSame('youtube', $media->extra?->source ?? null);
    }

    public function test_create_action_is_authorized_against_the_item_policy(): void
    {
        $viewer = $this->createViewOnlyUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('create');

        $this->assertDatabaseCount('item_media', 0);
    }

    // ── Edit ─────────────────────────────────────────────────────────────────

    public function test_crud_user_edits_a_media_rows_language_and_extra(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $originalLanguage = Language::factory()->create();
        $newLanguage = Language::factory()->create();
        $media = ItemMedia::factory()->forItem($item)->create([
            'language_id' => $originalLanguage->id,
            'extra' => ['source' => 'legacy'],
        ]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ]);

        $component->mountTableAction('edit', $media);

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $this->assertSame($originalLanguage->id, $form->getFlatFields()['language']->getState());

        $component->setTableActionData([
            'type' => $media->type->value,
            'url' => $media->url,
            'title' => $media->title,
            'language' => $newLanguage->id,
            'display_order' => $media->display_order,
            'extra' => json_encode(['source' => 'updated']),
        ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $media->refresh();
        $this->assertSame($newLanguage->id, $media->language_id);
        $this->assertSame('updated', $media->extra?->source ?? null);
    }

    // ── Delete ───────────────────────────────────────────────────────────────

    public function test_crud_user_deletes_a_media_row(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $media = ItemMedia::factory()->forItem($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('delete', $media)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_media', ['id' => $media->id]);
    }
}
