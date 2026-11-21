<?php

namespace Tests\Filament;

use App\Filament\Resources\DynastyResource\Pages\ViewDynasty;
use App\Filament\Resources\DynastyResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\ItemTranslationResource\Pages\EditItemTranslation;
use App\Models\Author;
use App\Models\Context;
use App\Models\Dynasty;
use App\Models\DynastyTranslation;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use Filament\Tables\Actions\EditAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * The author, editor and translator selects of translation forms
 * (TranslationFormSchema::authorSelectField) show the chosen person's name
 * when a form opens on a translation that already credits someone. A
 * searchable select fetches that label with a Livewire call
 * (getFormSelectOptionLabel), which crashed while the label closure named its
 * parameter `$v`: Filament injects closure parameters by name.
 */
class AuthorSelectFieldTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_item_translation_edit_page_shows_the_credited_people(): void
    {
        $language = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $context = Context::factory()->create(['is_default' => true]);
        $author = Author::factory()->create(['name' => 'Jane *Author*']);
        $translator = Author::factory()->create(['name' => 'Alice Translator']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => Item::factory()->Object()->create()->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'author_id' => $author->id,
            'translator_id' => $translator->id,
        ]);

        $this->setCurrentPanel();

        $page = Livewire::actingAs($this->createCrudUser())
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->instance();

        $this->assertSame('Jane Author', $page->getFormSelectOptionLabel('data.author_id'));
        $this->assertSame('Alice Translator', $page->getFormSelectOptionLabel('data.translator_id'));
    }

    public function test_dynasty_translation_edit_form_shows_the_credited_author(): void
    {
        $language = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $dynasty = Dynasty::factory()->create();
        $author = Author::factory()->create(['name' => 'Ibn Khaldun']);
        $translation = DynastyTranslation::factory()->create([
            'dynasty_id' => $dynasty->id,
            'language_id' => $language->id,
            'author_id' => $author->id,
        ]);
        $this->setCurrentPanel();

        $manager = Livewire::actingAs($this->createReferenceDataUser())
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->mountTableAction(EditAction::class, $translation)
            ->assertHasNoTableActionErrors()
            ->instance();

        $this->assertSame('Ibn Khaldun', $manager->getFormSelectOptionLabel('mountedTableActionsData.0.author_id'));
    }
}
