<?php

namespace Tests\Filament\Support;

use App\Filament\Concerns\HasChangeParentAction;
use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager as CollectionItemsRelationManager;
use App\Filament\Resources\RoleResource\Pages\EditRole;
use App\Filament\Resources\RoleResource\RelationManagers\PermissionsRelationManager;
use App\Filament\Support\RecordSelect;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Dynasty;
use App\Models\Glossary;
use App\Models\Item;
use App\Models\Language;
use App\Models\Tag;
use App\Models\Timeline;
use Closure;
use Filament\Forms\Components\Select;
use Filament\Tables\Actions\AssociateAction;
use Filament\Tables\Actions\AttachAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Livewire\Livewire;
use ReflectionClass;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\Models\Role;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Story #1891 (M7 epic #1871): RecordSelect is the one record-select helper —
 * server-side search on id/internal_name/backward_compatibility (or the
 * subset that exists on the model), labels from the `*DisplayLabel` helpers
 * where one exists, ordered, capped at 50, never preloaded.
 */
class RecordSelectTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    /**
     * The seven attach managers this story rewired, the two shared helpers
     * whose own record selects it also rewired, and the resources whose form
     * record selects later moved onto RecordSelect. None of these may call
     * ->preload() — every record select goes through RecordSelect, which
     * never preloads.
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
            'app/Filament/Resources/ItemResource.php',
            'app/Filament/Resources/TimelineResource.php',
            'app/Filament/Resources/TimelineEventResource.php',
        ];
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

    protected function makeRole(): Role
    {
        /** @var Role $role */
        $role = Role::create([
            'name' => 'Test role '.Str::random(8),
            'guard_name' => config('fortify.guard', 'web'),
        ]);

        return $role;
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

    // ── forItems() / forCollections(): the optional $scope parameter (#2074) ──

    /**
     * M7 story A1.5: a resource form's own parent-picker (ItemResource,
     * CollectionResource) passes $scope for its cycle guard. The
     * getSearchResultsUsing closure only gains a $record parameter when
     * $scope is given (see forItems()'s docblock) — Filament resolves that
     * parameter through the field's container, which a bare Select built by
     * these factories never has outside a mounted form. So this pulls the
     * raw closure via reflection and calls it directly, the same way
     * test_record_select_for_applies_a_scope_while_keeping_its_labels() below
     * reaches into an action's options-query closure.
     */
    private function getSearchResultsUsingCallback(Select $select): Closure
    {
        $reflection = new ReflectionClass($select);
        $property = $reflection->getProperty('getSearchResultsUsing');
        $property->setAccessible(true);

        /** @var Closure $callback */
        $callback = $property->getValue($select);

        return $callback;
    }

    public function test_for_items_scope_excludes_the_record_and_its_descendants_while_keeping_labels_and_cap(): void
    {
        $parent = Item::factory()->Object()->create(['internal_name' => 'root-item', 'backward_compatibility' => null]);
        $child = Item::factory()->Object()->create(['internal_name' => 'child-item', 'parent_id' => $parent->id]);
        $unrelated = Item::factory()->Object()->create(['internal_name' => 'unrelated-item', 'backward_compatibility' => null]);

        $select = RecordSelect::forItems(
            scope: fn ($query, $record) => $record instanceof Item
                ? RecordSelect::excludingDescendantsOf($query, $record)
                : $query,
        );

        $callback = $this->getSearchResultsUsingCallback($select);

        $scoped = $callback('item', $parent);
        $this->assertArrayNotHasKey($parent->id, $scoped);
        $this->assertArrayNotHasKey($child->id, $scoped);
        $this->assertArrayHasKey($unrelated->id, $scoped);
        $this->assertSame('unrelated-item', $scoped[$unrelated->id]);

        // No record (the create page): nothing is excluded.
        $unscoped = $callback('item', null);
        $this->assertArrayHasKey($parent->id, $unscoped);
        $this->assertArrayHasKey($child->id, $unscoped);
    }

    public function test_for_collections_scope_excludes_the_record_and_its_descendants_while_keeping_labels_and_cap(): void
    {
        $parent = $this->makeCollection();
        $parent->update(['internal_name' => 'root-collection', 'backward_compatibility' => null]);
        $child = Collection::factory()->create([
            'context_id' => $parent->context_id,
            'language_id' => $parent->language_id,
            'internal_name' => 'child-collection',
            'parent_id' => $parent->id,
            'backward_compatibility' => null,
        ]);
        $unrelated = Collection::factory()->create([
            'context_id' => $parent->context_id,
            'language_id' => $parent->language_id,
            'internal_name' => 'unrelated-collection',
            'backward_compatibility' => null,
        ]);

        $select = RecordSelect::forCollections(
            scope: fn ($query, $record) => $record instanceof Collection
                ? RecordSelect::excludingDescendantsOf($query, $record)
                : $query,
        );

        $callback = $this->getSearchResultsUsingCallback($select);

        $scoped = $callback('collection', $parent);
        $this->assertArrayNotHasKey($parent->id, $scoped);
        $this->assertArrayNotHasKey($child->id, $scoped);
        $this->assertArrayHasKey($unrelated->id, $scoped);
        $this->assertSame('unrelated-collection', $scoped[$unrelated->id]);

        // No record (the create page): nothing is excluded.
        $unscoped = $callback('collection', null);
        $this->assertArrayHasKey($parent->id, $unscoped);
        $this->assertArrayHasKey($child->id, $unscoped);
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

    // ── Timeline: no *DisplayLabel helper ────────────────────────────────────

    public function test_for_timelines_searches_by_id_internal_name_and_backward_compatibility_and_labels_with_legacy_code(): void
    {
        $target = Timeline::factory()->create([
            'internal_name' => 'islamic-timeline',
            'backward_compatibility' => 'mwnf3:hcr:country:01',
        ]);
        $plain = Timeline::factory()->create([
            'internal_name' => 'baroque-timeline',
            'backward_compatibility' => null,
        ]);

        $select = RecordSelect::forTimelines();

        $this->assertFalse($select->isPreloaded());
        $this->assertTrue($select->isRequired());
        $this->assertArrayHasKey($target->id, $select->getSearchResults($target->id));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('hcr:country:01'));
        $this->assertArrayHasKey($target->id, $select->getSearchResults('islamic'));
        $this->assertArrayNotHasKey($plain->id, $select->getSearchResults('islamic'));

        $this->assertSame('islamic-timeline [mwnf3:hcr:country:01]', $select->getSearchResults('islamic')[$target->id]);
        $this->assertSame('baroque-timeline', $select->getSearchResults('baroque')[$plain->id]);
    }

    // ── Glossary: self-pivot, no *DisplayLabel helper (M7 story A5.5, #2091) ──

    public function test_for_glossaries_searches_by_id_internal_name_and_backward_compatibility_and_labels_with_legacy_code(): void
    {
        $target = Glossary::factory()->create([
            'internal_name' => 'glossary-alpha',
            'backward_compatibility' => 'LEGACY-GLOSS-001',
        ]);
        Glossary::factory()->create(['internal_name' => 'unrelated-glossary']);

        $action = RecordSelect::recordSelectFor(AttachAction::make(), RecordSelect::GLOSSARIES);

        $this->assertFalse($action->isRecordSelectPreloaded());
        $this->assertSame(['id', 'internal_name', 'backward_compatibility'], $action->getRecordSelectSearchColumns());

        $reflection = new ReflectionClass($action);
        $property = $reflection->getProperty('modifyRecordSelectOptionsQueryUsing');
        $property->setAccessible(true);

        $ids = $property->getValue($action)(Glossary::query())->pluck('id')->all();
        $this->assertContains($target->id, $ids);

        $this->assertSame('glossary-alpha [LEGACY-GLOSS-001]', $action->getRecordTitle($target));
    }

    /**
     * The Synonyms relation manager's cycle guard: a Glossary can't be its
     * own synonym, so its Attach select's $scope excludes the owner record.
     */
    public function test_record_select_for_glossaries_scope_excludes_the_given_record_while_keeping_labels(): void
    {
        $owner = Glossary::factory()->create(['internal_name' => 'owner-glossary', 'backward_compatibility' => null]);
        $other = Glossary::factory()->create(['internal_name' => 'other-glossary', 'backward_compatibility' => null]);

        $action = RecordSelect::recordSelectFor(
            AttachAction::make(),
            RecordSelect::GLOSSARIES,
            fn ($query) => $query->where('id', '!=', $owner->id)
        );

        $reflection = new ReflectionClass($action);
        $property = $reflection->getProperty('modifyRecordSelectOptionsQueryUsing');
        $property->setAccessible(true);

        $ids = $property->getValue($action)(Glossary::query())->pluck('id')->all();

        $this->assertNotContains($owner->id, $ids);
        $this->assertContains($other->id, $ids);
        $this->assertSame('other-glossary', $action->getRecordTitle($other));
    }

    // ── Permission (Spatie): no internal_name or backward_compatibility ──────

    public function test_record_select_for_permissions_searches_by_name_and_orders_by_name(): void
    {
        $guard = config('fortify.guard', 'web');
        $target = SpatiePermission::firstOrCreate(['name' => 'zzz-target-permission', 'guard_name' => $guard]);
        SpatiePermission::firstOrCreate(['name' => 'aaa-unrelated-permission', 'guard_name' => $guard]);

        $action = RecordSelect::recordSelectFor(AttachAction::make(), RecordSelect::PERMISSIONS);

        $this->assertFalse($action->isRecordSelectPreloaded());
        $this->assertSame(['name', 'guard_name'], $action->getRecordSelectSearchColumns());

        $reflection = new ReflectionClass($action);
        $property = $reflection->getProperty('modifyRecordSelectOptionsQueryUsing');
        $property->setAccessible(true);

        // The app seeds its own permissions (access-admin-panel, view-data, ...)
        // for every test, so scope down to just the two rows this test created
        // before asserting order — the orderBy('name') the options query
        // applies stays intact underneath this added whereIn().
        $names = $property->getValue($action)(SpatiePermission::query())
            ->whereIn('name', ['aaa-unrelated-permission', 'zzz-target-permission'])
            ->pluck('name')->all();
        $this->assertSame(['aaa-unrelated-permission', 'zzz-target-permission'], $names);

        $this->assertSame("{$target->name} [{$guard}]", $action->getRecordTitle($target));
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

    // ── excludingAncestorsOf() (M7 story A1.1, #1896) ────────────────────────

    /**
     * A 4-level chain proves transitivity: every ancestor up the chain is
     * excluded, not just the immediate parent (great-grandparent is two
     * levels removed from $collection).
     */
    public function test_excluding_ancestors_of_excludes_the_record_and_its_ancestors(): void
    {
        $greatGrandparent = $this->makeCollection();
        $grandparent = Collection::factory()->create([
            'context_id' => $greatGrandparent->context_id,
            'language_id' => $greatGrandparent->language_id,
            'parent_id' => $greatGrandparent->id,
        ]);
        $parent = Collection::factory()->create([
            'context_id' => $greatGrandparent->context_id,
            'language_id' => $greatGrandparent->language_id,
            'parent_id' => $grandparent->id,
        ]);
        $collection = Collection::factory()->create([
            'context_id' => $greatGrandparent->context_id,
            'language_id' => $greatGrandparent->language_id,
            'parent_id' => $parent->id,
        ]);
        $unrelated = Collection::factory()->create([
            'context_id' => $greatGrandparent->context_id,
            'language_id' => $greatGrandparent->language_id,
        ]);

        $ids = RecordSelect::excludingAncestorsOf(Collection::query(), $collection)->pluck('id')->all();

        $this->assertNotContains($collection->id, $ids);
        $this->assertNotContains($parent->id, $ids);
        $this->assertNotContains($grandparent->id, $ids);
        $this->assertNotContains($greatGrandparent->id, $ids);
        $this->assertContains($unrelated->id, $ids);
    }

    public function test_excluding_ancestors_of_is_a_noop_for_a_model_without_the_scope(): void
    {
        $tag = Tag::factory()->create();
        $other = Tag::factory()->create();

        $ids = RecordSelect::excludingAncestorsOf(Tag::query(), $tag)->pluck('id')->all();

        $this->assertContains($tag->id, $ids);
        $this->assertContains($other->id, $ids);
    }

    // ── recordSelectFor(): the optional $scope parameter (#1896) ────────────

    /**
     * The second correction from #1896: a cycle guard must be applied INSIDE
     * recordSelectFor()'s own options-query closure (via $scope), never by
     * calling recordSelectOptionsQuery() a second time afterwards — Filament
     * keeps only the last closure it's given, so a second call would
     * silently drop the labels/ordering recordSelectFor() just set. This
     * proves both survive together: the scope narrows the candidates AND the
     * composite label/order this method sets stay intact.
     */
    public function test_record_select_for_applies_a_scope_while_keeping_its_labels(): void
    {
        $ancestor = $this->makeCollection();
        $collection = Collection::factory()->create([
            'context_id' => $ancestor->context_id,
            'language_id' => $ancestor->language_id,
            'parent_id' => $ancestor->id,
            'internal_name' => 'the-collection',
            'backward_compatibility' => null,
        ]);
        $unrelated = Collection::factory()->create([
            'context_id' => $ancestor->context_id,
            'language_id' => $ancestor->language_id,
            'internal_name' => 'unrelated-collection',
            'backward_compatibility' => null,
        ]);

        $action = RecordSelect::recordSelectFor(
            AssociateAction::make(),
            RecordSelect::COLLECTIONS,
            fn ($query) => RecordSelect::excludingAncestorsOf($query, $collection)
        );

        $reflection = new ReflectionClass($action);
        $property = $reflection->getProperty('modifyRecordSelectOptionsQueryUsing');
        $property->setAccessible(true);

        // get(), not pluck(): the options query carries a raw display_label
        // COALESCE column (from CollectionDisplayLabel::withDisplayLabel()),
        // so the records must be hydrated through it for getRecordTitle()
        // below to resolve the same label the real select would show.
        $records = $property->getValue($action)(Collection::query())->get();
        $ids = $records->pluck('id')->all();

        $this->assertNotContains($ancestor->id, $ids, 'the scope must still exclude the ancestor');
        $this->assertContains($unrelated->id, $ids, 'an unrelated collection must still be offered');

        // The label/order recordSelectFor() itself sets must survive the scope.
        $rehydratedUnrelated = $records->firstWhere('id', $unrelated->id);
        $this->assertNotNull($rehydratedUnrelated);
        $this->assertSame('unrelated-collection', $action->getRecordTitle($rehydratedUnrelated));
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

    /**
     * The Role Permissions manager's mounted attach select goes through
     * RecordSelect::recordSelectFor(): searchable by name, never preloaded.
     */
    public function test_role_permissions_attach_record_select_searches_by_name_and_never_preloads(): void
    {
        $user = $this->createRoleManagerUser();
        $role = $this->makeRole();
        $guard = config('fortify.guard', 'web');
        $target = SpatiePermission::firstOrCreate(['name' => 'attach-target-permission', 'guard_name' => $guard]);
        SpatiePermission::firstOrCreate(['name' => 'attach-noise-permission', 'guard_name' => $guard]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(PermissionsRelationManager::class, [
            'ownerRecord' => $role,
            'pageClass' => EditRole::class,
        ]);

        $component->mountTableAction('attach');

        $action = $component->instance()->getMountedTableAction();
        $this->assertInstanceOf(AttachAction::class, $action);
        $this->assertFalse($action->isRecordSelectPreloaded());

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $select = $form->getFlatFields()['recordId'];

        $this->assertTrue($select->isSearchable());
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
