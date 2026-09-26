<?php

namespace Tests\Filament\Support;

use App\Enums\Permission;
use App\Filament\Concerns\HasChangeParentAction;
use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager as CollectionItemsRelationManager;
use App\Filament\Support\RecordSelect;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Dynasty;
use App\Models\Item;
use App\Models\Language;
use App\Models\Tag;
use App\Models\User;
use Filament\Facades\Filament;
use Filament\Tables\Actions\AttachAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use ReflectionClass;
use Tests\TestCase;

/**
 * Story #1891 (M7 epic #1871): RecordSelect is the one record-select helper —
 * server-side search on id/internal_name/backward_compatibility (or the
 * subset that exists on the model), labels from the `*DisplayLabel` helpers
 * where one exists, ordered, capped at 50, never preloaded.
 */
class RecordSelectTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The seven attach managers this story rewired, plus the two shared
     * helpers whose own record selects it also rewired. None of these may
     * call ->preload() — every record select goes through RecordSelect,
     * which never preloads.
     *
     * @return array<int, string>
     */
    protected function filesGovernedByThisStory(): array
    {
        return [
            'app/Filament/Resources/CollectionResource/RelationManagers/ItemsRelationManager.php',
            'app/Filament/Resources/CollectionResource/RelationManagers/PartnersRelationManager.php',
            'app/Filament/Resources/ItemResource/RelationManagers/TagsRelationManager.php',
            'app/Filament/Resources/ItemResource/RelationManagers/ArtistsRelationManager.php',
            'app/Filament/Resources/ItemResource/RelationManagers/WorkshopsRelationManager.php',
            'app/Filament/Resources/ItemResource/RelationManagers/DynastiesRelationManager.php',
            'app/Filament/Resources/TimelineEventResource/RelationManagers/ItemsRelationManager.php',
            'app/Filament/Concerns/HasChangeParentAction.php',
            'app/Filament/Support/TranslationFormSchema.php',
            'app/Filament/Support/RecordSelect.php',
        ];
    }

    protected function createCrudUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
            Permission::UPDATE_DATA->value,
            Permission::DELETE_DATA->value,
        ]);

        return $user;
    }

    protected function setCurrentPanel(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    protected function makeCollection(): Collection
    {
        $context = Context::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        return Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
    }

    // ── Convention: no record select preloads ───────────────────────────────

    public function test_no_file_governed_by_this_story_preloads_its_record_select(): void
    {
        foreach ($this->filesGovernedByThisStory() as $relativePath) {
            $path = base_path($relativePath);
            $this->assertFileExists($path);

            $contents = file_get_contents($path);
            $this->assertIsString($contents);
            $this->assertStringNotContainsString(
                'preload(',
                $contents,
                "{$relativePath} must not preload a record select (RecordSelect never preloads)."
            );
        }
    }

    public function test_has_change_parent_action_never_calls_preload_record_select(): void
    {
        $reflection = new ReflectionClass(HasChangeParentAction::class);
        $this->assertFalse(method_exists($reflection->getName(), 'preloadRecordSelect'));
    }

    // ── forItems() / forCollections(): the acceptance line ──────────────────

    public function test_for_items_finds_records_by_id_backward_compatibility_and_internal_name_fragment(): void
    {
        $target = Item::factory()->Object()->create([
            'internal_name' => 'temple-relief-alpha',
            'backward_compatibility' => 'LEGACY-ITEM-001',
        ]);
        Item::factory()->Object()->create([
            'internal_name' => 'unrelated-item',
            'backward_compatibility' => 'LEGACY-ITEM-002',
        ]);

        $select = RecordSelect::forItems();

        $this->assertArrayHasKey($target->id, $select->getSearchResults($target->id));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('LEGACY-ITEM-001'));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('temple-relief'));
    }

    public function test_for_collections_finds_records_by_id_backward_compatibility_and_internal_name_fragment(): void
    {
        $context = Context::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        $target = Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
            'internal_name' => 'jordan-collection-alpha',
            'backward_compatibility' => 'LEGACY-COL-001',
        ]);
        Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
            'internal_name' => 'unrelated-collection',
            'backward_compatibility' => 'LEGACY-COL-002',
        ]);

        $select = RecordSelect::forCollections();

        $this->assertArrayHasKey($target->id, $select->getSearchResults($target->id));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('LEGACY-COL-001'));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('jordan-collection'));
    }

    public function test_for_items_caps_results_at_fifty(): void
    {
        foreach (range(1, 55) as $i) {
            Item::factory()->Object()->create(['internal_name' => "cap-test-item-{$i}"]);
        }

        $results = RecordSelect::forItems()->getSearchResults('cap-test-item');

        $this->assertCount(50, $results);
    }

    // ── Dynasty: no internal_name column ─────────────────────────────────────

    public function test_for_dynasties_searches_by_id_and_backward_compatibility_only(): void
    {
        $target = Dynasty::factory()->create(['backward_compatibility' => 'DYN-001']);
        Dynasty::factory()->create(['backward_compatibility' => 'DYN-002']);

        $select = RecordSelect::forDynasties();

        $this->assertArrayHasKey($target->id, $select->getSearchResults($target->id));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('DYN-001'));
    }

    // ── excludingDescendantsOf() ──────────────────────────────────────────────

    public function test_excluding_descendants_of_excludes_the_record_and_its_descendants(): void
    {
        $grandparent = Item::factory()->Object()->create();
        $parent = Item::factory()->Object()->create(['parent_id' => $grandparent->id]);
        $child = Item::factory()->Object()->create(['parent_id' => $parent->id]);
        $unrelated = Item::factory()->Object()->create();

        $ids = RecordSelect::excludingDescendantsOf(Item::query(), $parent)->pluck('id')->all();

        $this->assertNotContains($parent->id, $ids);
        $this->assertNotContains($child->id, $ids);
        $this->assertContains($grandparent->id, $ids);
        $this->assertContains($unrelated->id, $ids);
    }

    public function test_excluding_descendants_of_is_a_noop_for_a_model_without_the_scope(): void
    {
        $tag = Tag::factory()->create();
        $other = Tag::factory()->create();

        $ids = RecordSelect::excludingDescendantsOf(Tag::query(), $tag)->pluck('id')->all();

        $this->assertContains($tag->id, $ids);
        $this->assertContains($other->id, $ids);
    }

    // ── recordSelectFor(): the AttachAction adapter, end to end ─────────────

    public function test_collection_items_attach_record_select_uses_bounded_search_and_never_preloads(): void
    {
        $user = $this->createCrudUser();
        $collection = $this->makeCollection();
        $target = Item::factory()->Object()->create([
            'internal_name' => 'attach-target-item',
            'backward_compatibility' => 'ATTACH-001',
        ]);
        Item::factory()->Object()->create(['internal_name' => 'attach-noise-item']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(CollectionItemsRelationManager::class, [
            'ownerRecord' => $collection,
            'pageClass' => EditCollection::class,
        ]);

        $component->mountTableAction('attach');

        $action = $component->instance()->getMountedTableAction();
        $this->assertInstanceOf(AttachAction::class, $action);

        $this->assertFalse($action->isRecordSelectPreloaded());
        $this->assertSame(['id', 'internal_name', 'backward_compatibility'], $action->getRecordSelectSearchColumns());

        // Fetch the actually-mounted select (bound to the Livewire form's
        // container) rather than $action->getRecordSelect(), which builds a
        // fresh, unmounted Select every call and can't evaluate a search.
        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $select = $form->getFlatFields()['recordId'];

        $this->assertArrayHasKey($target->id, $select->getSearchResults($target->id));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('ATTACH-001'));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('attach-target'));
    }

    // ── TranslationFormSchema delegates to RecordSelect ─────────────────────

    public function test_translation_form_schema_item_select_field_delegates_to_record_select(): void
    {
        $target = Item::factory()->Object()->create([
            'internal_name' => 'delegate-target-item',
            'backward_compatibility' => 'DELEGATE-001',
        ]);

        $select = TranslationFormSchema::itemSelectField();

        $this->assertArrayHasKey($target->id, $select->getSearchResults($target->id));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('DELEGATE-001'));
    }
}
