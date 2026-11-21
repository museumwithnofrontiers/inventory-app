<?php

namespace Tests\Filament;

use App\Filament\Resources\ItemItemLinkResource\Pages\EditItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\RelationManagers\TranslationsRelationManager as ItemItemLinkTranslationsRelationManager;
use App\Filament\Resources\ItemTranslationResource\Pages\EditItemTranslation;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemItemLink;
use App\Models\ItemItemLinkTranslation;
use App\Models\ItemTranslation;
use App\Models\Language;
use Filament\Forms\Components\MarkdownEditor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Text fields are edited with Filament's MarkdownEditor, which formats the
 * Markdown while it is typed and stores the text as written. It never takes
 * a file: an attached picture would bypass the image pipeline.
 */
class MarkdownEditorFieldsTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    /** Emphasis, an escape, a single newline, a blank line and raw HTML. */
    private const STORED = "*Marble*, carved \\[1\\]\nsecond line\n\n<i>raw</i> **strong**";

    private Language $language;

    private Context $context;

    protected function setUp(): void
    {
        parent::setUp();

        $this->language = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $this->context = Context::factory()->create(['is_default' => true]);
    }

    private function translation(): ItemTranslation
    {
        return ItemTranslation::factory()->create([
            'item_id' => Item::factory()->Object()->create()->id,
            'language_id' => $this->language->id,
            'context_id' => $this->context->id,
            'description' => self::STORED,
            'bibliography' => self::STORED,
        ]);
    }

    public function test_a_markdown_editor_has_no_attach_files_button(): void
    {
        $editor = MarkdownEditor::make('description');

        $this->assertNotContains('attachFiles', $editor->getToolbarButtons());
        $this->assertContains('bold', $editor->getToolbarButtons());
    }

    public function test_item_translation_texts_use_the_markdown_editor(): void
    {
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(EditItemTranslation::class, ['record' => $this->translation()->getRouteKey()])
            ->assertFormFieldExists('description', fn (mixed $field): bool => $field instanceof MarkdownEditor)
            ->assertFormFieldExists('bibliography', fn (mixed $field): bool => $field instanceof MarkdownEditor);
    }

    public function test_saving_the_form_keeps_the_stored_markdown_as_written(): void
    {
        $translation = $this->translation();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertFormSet(['description' => self::STORED])
            ->call('save')
            ->assertHasNoFormErrors();

        $translation->refresh();
        $this->assertSame(self::STORED, $translation->description);
        $this->assertSame(self::STORED, $translation->bibliography);
    }

    public function test_an_upload_sent_to_a_markdown_field_is_refused(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(EditItemTranslation::class, ['record' => $this->translation()->getRouteKey()])
            ->set('componentFileAttachments.data.description', UploadedFile::fake()->image('picture.png'))
            ->call('getFormComponentFileAttachmentUrl', 'data.description')
            ->assertForbidden();

        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_the_item_link_translation_view_escapes_raw_html(): void
    {
        $link = ItemItemLink::factory()->create([
            'source_id' => Item::factory()->Object()->create()->id,
            'target_id' => Item::factory()->Object()->create()->id,
        ]);
        $translation = ItemItemLinkTranslation::factory()->create([
            'item_item_link_id' => $link->id,
            'language_id' => $this->language->id,
            'description' => self::STORED,
        ]);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ItemItemLinkTranslationsRelationManager::class, [
                'ownerRecord' => $link,
                'pageClass' => EditItemItemLink::class,
            ])
            ->mountTableAction('view', $translation)
            ->assertSeeHtml('<em>Marble</em>')
            ->assertSeeHtml('&lt;i&gt;raw&lt;/i&gt;')
            ->assertDontSeeHtml('<i>raw</i>');
    }
}
