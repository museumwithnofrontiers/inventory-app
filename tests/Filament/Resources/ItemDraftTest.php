<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ItemResource\Pages\CreateItem;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\Pages\ListItem;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\ItemTranslationResource\Pages\CreateItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\ListItemTranslation;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M17 B1 (#2744): the draft flag of an item and of an item text in the panel.
 * A new one starts as a draft.
 */
class ItemDraftTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_a_new_item_starts_as_a_draft(): void
    {
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(CreateItem::class)
            ->assertFormSet(['draft' => true]);
    }

    public function test_the_item_form_sets_the_draft_flag(): void
    {
        $item = Item::factory()->create(['draft' => false]);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(EditItem::class, ['record' => $item->getRouteKey()])
            ->assertFormSet(['draft' => false])
            ->fillForm(['draft' => true])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertTrue($item->refresh()->draft);
    }

    public function test_the_item_list_filters_the_drafts(): void
    {
        $ready = Item::factory()->create(['draft' => false]);
        $draft = Item::factory()->create(['draft' => true]);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ListItem::class)
            ->filterTable('draft', true)
            ->assertCanSeeTableRecords([$draft])
            ->assertCanNotSeeTableRecords([$ready]);
    }

    public function test_a_new_item_text_starts_as_a_draft(): void
    {
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(CreateItemTranslation::class)
            ->assertFormSet(['draft' => true]);
    }

    public function test_the_text_list_filters_the_drafts(): void
    {
        $ready = ItemTranslation::factory()->create(['draft' => false]);
        $draft = ItemTranslation::factory()->create(['draft' => true]);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ListItemTranslation::class)
            ->filterTable('draft', true)
            ->assertCanSeeTableRecords([$draft])
            ->assertCanNotSeeTableRecords([$ready]);
    }

    public function test_the_default_translation_shortcut_starts_the_text_as_a_draft(): void
    {
        Language::factory()->create(['is_default' => true]);
        Context::factory()->create(['is_default' => true]);
        $item = Item::factory()->create();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $item, 'pageClass' => ViewItem::class])
            ->mountTableAction('createDefaultTranslation')
            ->assertTableActionDataSet(['draft' => true]);
    }
}
