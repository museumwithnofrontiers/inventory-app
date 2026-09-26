<?php

namespace Tests\Filament;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ChildCollectionsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\ImagesRelationManager as CollectionImagesRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager as CollectionItemsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\PartnersRelationManager as CollectionPartnersRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\TranslationsRelationManager as CollectionTranslationsRelationManager;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\RelationManagers\ArtistsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\ChildItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\CollectionAppearancesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DocumentsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DynastiesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\ImagesRelationManager as ItemImagesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\IncomingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\MediaRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\OutgoingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\PictureItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TimelineEventsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager as ItemTranslationsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\WorkshopsRelationManager;
use App\Filament\Resources\PartnerResource;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\CollectionParticipationsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\ImagesRelationManager as PartnerImagesRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\OwnedItemsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\TranslationsRelationManager as PartnerTranslationsRelationManager;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use Filament\Actions\ActionGroup as BaseActionGroup;
use Filament\Actions\MountableAction;
use Filament\Resources\RelationManagers\RelationGroup;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\AssociateAction;
use Filament\Tables\Actions\AttachAction;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use PHPUnit\Framework\Assert;
use PHPUnit\Framework\AssertionFailedError;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionClass;
use ReflectionProperty;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A0.5 (epic #1871): the milestone's enforcement mechanism.
 *
 * Iterates every relation manager registered via getRelations() on
 * CollectionResource, PartnerResource and ItemResource (RelationGroups
 * flattened) and classifies each into exactly one kind:
 *
 * - has-many:      #1896-#1899 (Collection/Item children, Item picture items,
 *                  Partner owned items).
 * - pivot:         #1900-#1903 (collection_item, collection_partner,
 *                  timeline_event_item, tags/artists/workshops/dynasties).
 * - translations:  #1904 (Collection/Item/Partner TranslationsRelationManager).
 * - inline:        #1906-#1908 (Item Media, Item Documents).
 * - pinned:        the three Images managers and the two Item Links managers.
 *                  No convention fits them and no story migrates them; their
 *                  CURRENT action names/order are pinned exactly as-is.
 *
 * self::PENDING lists every has-many/pivot/translations/inline manager that
 * doesn't yet meet its kind's full target. Each later story (A1-A5) removes
 * its own manager(s) from this list as part of its PR; the milestone's DoD is
 * this list being empty.
 *
 * Per manager (data-provider driven, one case per manager):
 * - Not pending (and every pinned manager): must fully meet its target,
 *   including the shared rules below. This is the acceptance: removing an
 *   entry without implementing the convention fails the test.
 * - Pending: only asserted to be a real manager of one of the three
 *   resources, AND asserted to NOT already fully meet its target (a stale
 *   compliant entry left on the pending list also fails the test).
 * - Unclassified (not in self::CLASSIFICATION): fails with a clear message.
 *
 * Shared rules, asserted on every non-pending manager (all kinds, including
 * pinned): AuthorizesRelationMutations is used; every record select comes
 * from RecordSelect (source + behaviour checks, see
 * {@see self::assertRecordSelectSourceRule()}); pagination is capped at
 * [25, 50, 100]; a pivot's backward_compatibility column, where present, is
 * hidden-by-default and excluded from the attach form.
 */
class RelationManagerConventionTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    private const KIND_HAS_MANY = 'has-many';

    private const KIND_PIVOT = 'pivot';

    private const KIND_TRANSLATIONS = 'translations';

    private const KIND_INLINE = 'inline';

    private const KIND_PINNED = 'pinned';

    /**
     * Every relation manager of CollectionResource, PartnerResource and
     * ItemResource, classified into exactly one kind. A manager registered
     * via getRelations() but missing here fails the test with a clear
     * message (see {@see self::classify()}).
     *
     * @var array<class-string, array<string, mixed>>
     */
    private const CLASSIFICATION = [
        // ── has-many (#1896-#1899) ──────────────────────────────────────
        ChildCollectionsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'collection'],
        ChildItemsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'item'],
        PictureItemsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'item'],
        OwnedItemsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'partner'],

        // ── pivot (#1900-#1903) ─────────────────────────────────────────
        CollectionItemsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'collection', 'edit' => true, 'extraRow' => ['view_appearance']],
        CollectionPartnersRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'collection', 'edit' => true],
        CollectionAppearancesRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => true, 'extraRow' => ['view_appearance']],
        TagsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => false],
        ArtistsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => false],
        WorkshopsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => false],
        DynastiesRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => false],
        TimelineEventsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => true, 'bcColumn' => true],
        CollectionParticipationsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'partner', 'edit' => true],

        // ── translations (#1904) ────────────────────────────────────────
        CollectionTranslationsRelationManager::class => ['kind' => self::KIND_TRANSLATIONS, 'owner' => 'collection', 'viewParent' => 'viewParentCollection'],
        ItemTranslationsRelationManager::class => ['kind' => self::KIND_TRANSLATIONS, 'owner' => 'item', 'viewParent' => 'viewParentItem'],
        PartnerTranslationsRelationManager::class => ['kind' => self::KIND_TRANSLATIONS, 'owner' => 'partner', 'viewParent' => 'viewParentPartner'],

        // ── inline (#1906-#1908) ────────────────────────────────────────
        MediaRelationManager::class => ['kind' => self::KIND_INLINE, 'owner' => 'item', 'variant' => 'media'],
        DocumentsRelationManager::class => ['kind' => self::KIND_INLINE, 'owner' => 'item', 'variant' => 'documents'],

        // ── pinned — current shape, never migrated ─────────────────────
        CollectionImagesRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'collection',
            'pinnedHeader' => ['attach'], 'pinnedRow' => ['view_image', 'download', 'edit', 'detach', 'delete'], 'pinnedBulk' => [],
        ],
        ItemImagesRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'item',
            'pinnedHeader' => ['attach'], 'pinnedRow' => ['view_image', 'download', 'edit', 'detach', 'delete'], 'pinnedBulk' => [],
        ],
        PartnerImagesRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'partner',
            'pinnedHeader' => ['attach'], 'pinnedRow' => ['view_image', 'download', 'edit', 'detach', 'delete'], 'pinnedBulk' => [],
        ],
        OutgoingLinksRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'item',
            'pinnedHeader' => ['create'], 'pinnedRow' => ['viewLink', 'edit', 'delete'], 'pinnedBulk' => [],
        ],
        IncomingLinksRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'item',
            'pinnedHeader' => ['create'], 'pinnedRow' => ['viewLink', 'edit', 'delete'], 'pinnedBulk' => [],
        ],
    ];

    /**
     * Managers that don't yet meet their kind's full target. Originally every
     * has-many, pivot, translations and inline manager (18) — nothing had
     * migrated yet. M7 Story A2.1 (#1900) was the first to land, removing
     * CollectionItemsRelationManager and CollectionAppearancesRelationManager
     * (the collection_item pivot, both sides). Each story removes its own
     * entry as part of its PR.
     *
     * @var array<int, class-string>
     */
    private const PENDING = [
        // has-many (3) — #1864's audit: no actions at all today.
        // ChildCollectionsRelationManager: done by A1.1 (#1896).
        ChildItemsRelationManager::class,
        PictureItemsRelationManager::class,
        OwnedItemsRelationManager::class,

        // pivot (7)
        CollectionPartnersRelationManager::class,
        TagsRelationManager::class,
        ArtistsRelationManager::class,
        WorkshopsRelationManager::class,
        DynastiesRelationManager::class,
        TimelineEventsRelationManager::class,
        CollectionParticipationsRelationManager::class,

        // translations (3)
        CollectionTranslationsRelationManager::class,
        ItemTranslationsRelationManager::class,
        PartnerTranslationsRelationManager::class,

        // inline (2)
        MediaRelationManager::class,
        DocumentsRelationManager::class,
    ];

    // ── Discovery ────────────────────────────────────────────────────────────

    /**
     * @return array<string, array{0: class-string}>
     */
    public static function managerProvider(): array
    {
        $cases = [];

        foreach (self::allManagers() as $class) {
            $cases[$class] = [$class];
        }

        return $cases;
    }

    /**
     * Every relation manager currently registered on the three resources,
     * discovered from their own getRelations() rather than a hardcoded list
     * — so a manager added later without updating self::CLASSIFICATION is
     * caught by {@see self::classify()} instead of silently skipped.
     *
     * @return array<int, class-string>
     */
    private static function allManagers(): array
    {
        return array_values(array_unique([
            ...self::flattenRelations(CollectionResource::getRelations()),
            ...self::flattenRelations(PartnerResource::getRelations()),
            ...self::flattenRelations(ItemResource::getRelations()),
        ]));
    }

    /**
     * @param  array<int, mixed>  $relations
     * @return array<int, class-string>
     */
    private static function flattenRelations(array $relations): array
    {
        $managers = [];

        foreach ($relations as $relation) {
            if ($relation instanceof RelationGroup) {
                foreach ($relation->getManagers() as $manager) {
                    $managers[] = $manager;
                }

                continue;
            }

            if (is_string($relation)) {
                $managers[] = $relation;
            }
        }

        return $managers;
    }

    // ── The convention matrix ────────────────────────────────────────────────

    #[DataProvider('managerProvider')]
    public function test_relation_manager_matches_its_convention(string $managerClass): void
    {
        $config = $this->classify($managerClass);

        if ($config['kind'] === self::KIND_PINNED) {
            // Pinned managers are never on the pending list: they must always
            // match their current snapshot exactly, plus the shared rules.
            $this->assertMeetsTarget($managerClass, $config);
            $this->assertSharedRules($managerClass, $config);

            return;
        }

        if (in_array($managerClass, self::PENDING, true)) {
            $this->assertIsRealManager($managerClass, $config);
            $this->assertFalse(
                $this->fullyCompliant($managerClass, $config),
                "{$managerClass} is on the pending allow-list but already fully meets its [{$config['kind']}] convention target ".
                'plus the shared rules — remove it from RelationManagerConventionTest::PENDING.'
            );

            return;
        }

        $this->assertMeetsTarget($managerClass, $config);
        $this->assertSharedRules($managerClass, $config);
    }

    public function test_pending_allow_list_only_names_managers_registered_on_the_three_resources(): void
    {
        $unknown = array_diff(self::PENDING, self::allManagers());

        $this->assertSame(
            [],
            array_values($unknown),
            'RelationManagerConventionTest::PENDING references manager(s) that are not registered on CollectionResource, PartnerResource or ItemResource: '.implode(', ', $unknown)
        );
    }

    public function test_the_three_resources_register_the_expected_number_of_relation_managers(): void
    {
        // 4 has-many + 9 pivot + 3 translations + 2 inline + 5 pinned = 23.
        // A change here means a manager was added or removed on Collection,
        // Partner or Item — classify it in self::CLASSIFICATION (and, if it
        // isn't yet convention-compliant, list it in self::PENDING) rather
        // than letting this count silently drift.
        $this->assertCount(23, self::allManagers());
    }

    private function classify(string $class): array
    {
        $config = self::CLASSIFICATION[$class] ?? null;

        if ($config === null) {
            Assert::fail(
                "Relation manager [{$class}] is registered via getRelations() on CollectionResource, PartnerResource or ItemResource ".
                'but is not classified in RelationManagerConventionTest::CLASSIFICATION. Classify it as has-many, pivot, translations, '.
                'inline or pinned before this test can hold it to (or exempt it from) a convention.'
            );
        }

        return $config;
    }

    private function fullyCompliant(string $class, array $config): bool
    {
        try {
            $this->assertMeetsTarget($class, $config);
            $this->assertSharedRules($class, $config);

            return true;
        } catch (AssertionFailedError) {
            return false;
        }
    }

    private function assertMeetsTarget(string $class, array $config): void
    {
        match ($config['kind']) {
            self::KIND_HAS_MANY => $this->assertHasManyConvention($class, $config),
            self::KIND_PIVOT => $this->assertPivotConvention($class, $config),
            self::KIND_TRANSLATIONS => $this->assertTranslationsConvention($class, $config),
            self::KIND_INLINE => $this->assertInlineConvention($class, $config),
            self::KIND_PINNED => $this->assertPinnedConvention($class, $config),
        };
    }

    // ── has-many (#1896-#1899) ───────────────────────────────────────────────

    private function assertHasManyConvention(string $class, array $config): void
    {
        $component = $this->mountManager($class, $config);
        $table = $component->instance()->getTable();

        $header = $this->flattenActions($table->getHeaderActions());
        $this->assertSame(['create', 'associate'], $this->namesOf($header), "{$class}: header actions must be exactly [create, associate] in that order.");
        $this->assertActionHasUrl($header[0], "{$class}: header 'create' must navigate to the child Resource's Create page (via ResourceCreateUrl), not open a modal form.");
        $this->assertInstanceOf(AssociateAction::class, $header[1], "{$class}: header 'associate' must be Filament's AssociateAction.");
        $this->assertSame('Attach existing', $header[1]->getLabel(), "{$class}: 'associate' must be labelled 'Attach existing'.");

        $row = $this->flattenActions($table->getActions());
        $this->assertSame(['view', 'edit', 'dissociate', 'delete'], $this->namesOf($row), "{$class}: row actions must be exactly [view, edit, dissociate, delete] in that order.");
        $this->assertActionHasUrl($row[1], "{$class}: row 'edit' must navigate to the child Resource's Edit page.");
        $this->assertSame('Detach', $row[2]->getLabel(), "{$class}: row 'dissociate' must be labelled 'Detach'.");

        $bulk = $this->flattenActions($table->getBulkActions());
        $this->assertSame(['dissociate'], $this->namesOf($bulk), "{$class}: bulk actions must be exactly [dissociate].");
    }

    // ── pivot (#1900-#1903) ──────────────────────────────────────────────────

    private function assertPivotConvention(string $class, array $config): void
    {
        $component = $this->mountManager($class, $config);
        $table = $component->instance()->getTable();

        $header = $this->flattenActions($table->getHeaderActions());
        $this->assertSame(['attach'], $this->namesOf($header), "{$class}: header actions must be exactly [attach].");
        $this->assertInstanceOf(AttachAction::class, $header[0], "{$class}: header 'attach' must be Filament's AttachAction.");

        $expectedRow = $config['edit'] ? ['view', 'edit', 'detach'] : ['view', 'detach'];
        $expectedRow = [...$expectedRow, ...($config['extraRow'] ?? [])];

        $row = $this->flattenActions($table->getActions());
        $this->assertSame($expectedRow, $this->namesOf($row), "{$class}: row actions must be exactly [".implode(', ', $expectedRow).'] in that order.');

        $bulk = $this->flattenActions($table->getBulkActions());
        $this->assertSame(['detach'], $this->namesOf($bulk), "{$class}: bulk actions must be exactly [detach].");
    }

    // ── translations (#1904) ─────────────────────────────────────────────────

    private function assertTranslationsConvention(string $class, array $config): void
    {
        $component = $this->mountManager($class, $config);
        $table = $component->instance()->getTable();

        $header = $this->flattenActions($table->getHeaderActions());
        $this->assertSame(['create', 'createDefaultTranslation'], $this->namesOf($header), "{$class}: header actions must be exactly [create, createDefaultTranslation].");
        $this->assertActionHasUrl($header[0], "{$class}: header 'create' must navigate to the *TranslationResource Create page (via ResourceCreateUrl), not open an inline form.");

        $row = $this->flattenActions($table->getActions());
        $this->assertSame(
            ['viewTranslation', 'editTranslation', $config['viewParent'], 'delete'],
            $this->namesOf($row),
            "{$class}: row actions must be exactly [viewTranslation, editTranslation, {$config['viewParent']}, delete] in that order."
        );
        $this->assertActionHasUrl($row[1], "{$class}: 'editTranslation' must navigate to the *TranslationResource Edit page.");
    }

    // ── inline (#1906-#1908) ─────────────────────────────────────────────────

    private function assertInlineConvention(string $class, array $config): void
    {
        match ($config['variant']) {
            'media' => $this->assertMediaConvention($class, $config),
            'documents' => $this->assertDocumentsConvention($class, $config),
        };
    }

    /**
     * Target per #1908: inline Create/Edit stays (no Resource exists for
     * Media), gains `language` and `extra` fields, stays behind
     * AuthorizesRelationMutations (checked as a shared rule).
     */
    private function assertMediaConvention(string $class, array $config): void
    {
        $component = $this->mountManager($class, $config);
        $table = $component->instance()->getTable();

        $header = $this->flattenActions($table->getHeaderActions());
        $this->assertSame(['create'], $this->namesOf($header), "{$class}: header actions must be exactly [create] (inline modal — no Resource to navigate to).");

        $row = $this->flattenActions($table->getActions());
        $this->assertSame(['edit', 'delete'], $this->namesOf($row), "{$class}: row actions must be exactly [edit, delete].");

        $fields = $this->mountedActionFieldNames($component, 'create');
        $this->assertContains('language', $fields, "{$class}: the inline Create/Edit form must include a 'language' field (#1908).");
        $this->assertContains('extra', $fields, "{$class}: the inline Create/Edit form must include an 'extra' field (#1908).");
    }

    /**
     * Target per #1906/#1907: a header `Upload` action (queued validation),
     * row `Download` / `Edit` (metadata modal) / `Delete`. Provisional: the
     * documents design story (A4.1, #1905) may rename these, and the story
     * that implements the design updates this expectation to match.
     */
    private function assertDocumentsConvention(string $class, array $config): void
    {
        $component = $this->mountManager($class, $config);
        $table = $component->instance()->getTable();

        $header = $this->flattenActions($table->getHeaderActions());
        $this->assertSame(['upload'], $this->namesOf($header), "{$class}: header actions must be exactly [upload] (#1906).");

        $row = $this->flattenActions($table->getActions());
        $this->assertSame(['download', 'edit', 'delete'], $this->namesOf($row), "{$class}: row actions must be exactly [download, edit, delete] (#1907).");
    }

    // ── pinned ───────────────────────────────────────────────────────────────

    private function assertPinnedConvention(string $class, array $config): void
    {
        $component = $this->mountManager($class, $config);
        $table = $component->instance()->getTable();

        $this->assertSame(
            $config['pinnedHeader'],
            $this->namesOf($this->flattenActions($table->getHeaderActions())),
            "{$class}: pinned header actions changed. No story migrates this manager — if this change is intentional, update its pinned snapshot here and tell Pascal."
        );
        $this->assertSame(
            $config['pinnedRow'],
            $this->namesOf($this->flattenActions($table->getActions())),
            "{$class}: pinned row actions changed."
        );
        $this->assertSame(
            $config['pinnedBulk'],
            $this->namesOf($this->flattenActions($table->getBulkActions())),
            "{$class}: pinned bulk actions changed."
        );
    }

    // ── Shared rules (every non-pending manager, all kinds including pinned) ──

    private function assertSharedRules(string $class, array $config): void
    {
        $this->assertContains(
            AuthorizesRelationMutations::class,
            class_uses_recursive($class),
            "{$class}: must use App\\Filament\\Concerns\\AuthorizesRelationMutations."
        );

        $this->assertRecordSelectSourceRule($class);

        $component = $this->mountManager($class, $config);
        $table = $component->instance()->getTable();

        $this->assertSame([25, 50, 100], $table->getPaginationPageOptions(), "{$class}: pagination options must be exactly [25, 50, 100].");
        $this->assertNotContains('all', $table->getPaginationPageOptions(), "{$class}: pagination options must not include 'all'.");
        $this->assertSame(25, $table->getDefaultPaginationPageOption(), "{$class}: default pagination page option must be 25.");

        foreach ($this->attachOrAssociateActions($table) as $action) {
            $this->assertRecordSelectBehaviour($action, $class);
        }

        if ($config['bcColumn'] ?? false) {
            $this->assertPivotBackwardCompatibilityRule($component, $table, $class);
        }
    }

    /**
     * M7 story A0.2 locked RecordSelect as the one place an attach, associate
     * or parent select is built, but it sets no marker on the Select it
     * returns — there's nothing to introspect at runtime that proves "this
     * came from RecordSelect". So this is two checks instead of one:
     *
     * 1. Source (here): the manager's file, and those of its own base classes
     *    under app/, never preload a select, never replace or re-search the
     *    attach/associate record select themselves, and route every
     *    AttachAction/AssociateAction through `RecordSelect::recordSelectFor()`.
     *    A Select over an enum or a small reference table (a pivot's `level`,
     *    a media `type`, a language) is not a record select and stays
     *    allowed, and so does narrowing the options with
     *    `recordSelectOptionsQuery()` (a cycle guard).
     * 2. Behaviour ({@see self::assertRecordSelectBehaviour()}): the actual
     *    record select every attach/associate action ends up with is
     *    searchable and never preloaded, which is what RecordSelect
     *    guarantees regardless of how it was reached.
     */
    private function assertRecordSelectSourceRule(string $class): void
    {
        foreach ($this->sourceFilesOf($class) as $file) {
            $contents = file_get_contents($file);
            $this->assertIsString($contents, "Could not read [{$file}].");

            $this->assertStringNotContainsString('->preload(', $contents, "{$class}: {$file} must not preload a select — RecordSelect never preloads.");
            $this->assertStringNotContainsString('->recordSelect(', $contents, "{$class}: {$file} must not replace the attach/associate record select — build it with RecordSelect::recordSelectFor().");
            $this->assertStringNotContainsString('->recordSelectSearchColumns(', $contents, "{$class}: {$file} must not set its own record-select search columns — RecordSelect owns the search.");

            if (str_contains($contents, 'AttachAction::make(') || str_contains($contents, 'AssociateAction::make(')) {
                $this->assertStringContainsString('RecordSelect::recordSelectFor(', $contents, "{$class}: {$file} must adapt AttachAction/AssociateAction via RecordSelect::recordSelectFor().");
            }
        }
    }

    /**
     * The manager's own file and those of its parent classes that live under
     * app/ (BaseImagesRelationManager, for instance), so a select moved into
     * a shared base class is still checked.
     *
     * @return array<int, string>
     */
    private function sourceFilesOf(string $class): array
    {
        $files = [];

        for ($reflection = new ReflectionClass($class); $reflection !== false; $reflection = $reflection->getParentClass()) {
            $file = $reflection->getFileName();

            if ($file !== false && str_starts_with($file, app_path())) {
                $files[] = $file;
            }
        }

        return $files;
    }

    private function assertRecordSelectBehaviour(AttachAction|AssociateAction $action, string $class): void
    {
        $select = $action->getRecordSelect();

        $this->assertTrue($select->isSearchable(), "{$class}: the attach/associate record select must be searchable.");
        $this->assertFalse($select->isPreloaded(), "{$class}: the attach/associate record select must never be preloaded.");
    }

    /**
     * Scoped to what's reachable without a manager-specific attached-record
     * fixture: the pivot column's toggle state and the attach form. The
     * edit-pivot modal's fields are the implementing story's responsibility
     * to also verify once it has a real attached record to mount 'edit' on.
     */
    private function assertPivotBackwardCompatibilityRule(Testable $component, Table $table, string $class): void
    {
        $column = null;

        foreach ($table->getColumns() as $candidate) {
            if ($candidate->getName() === 'backward_compatibility') {
                $column = $candidate;

                break;
            }
        }

        if ($column === null) {
            return;
        }

        $this->assertTrue($column->isToggleable(), "{$class}: pivot 'backward_compatibility' column must be toggleable.");
        $this->assertTrue($column->isToggledHiddenByDefault(), "{$class}: pivot 'backward_compatibility' column must be hidden by default.");

        $attachFields = $this->mountedActionFieldNames($component, 'attach');
        $this->assertNotContains('backward_compatibility', $attachFields, "{$class}: the attach form must not expose backward_compatibility (importer-owned).");
    }

    // ── Action introspection helpers ─────────────────────────────────────────

    /**
     * Flattens header/row/bulk action definitions, expanding any
     * ActionGroup/BulkActionGroup in place, mirroring how Filament's own
     * `assertTableActionsExistInOrder()` flattens groups before comparing.
     *
     * @param  array<int, mixed>  $definitions
     * @return array<int, MountableAction>
     */
    private function flattenActions(array $definitions): array
    {
        $flat = [];

        foreach ($definitions as $action) {
            if ($action instanceof BaseActionGroup) {
                foreach ($action->getFlatActions() as $nested) {
                    $flat[] = $nested;
                }

                continue;
            }

            $flat[] = $action;
        }

        return $flat;
    }

    /**
     * @param  array<int, MountableAction>  $actions
     * @return array<int, string>
     */
    private function namesOf(array $actions): array
    {
        return array_map(fn ($action): string => (string) $action->getName(), $actions);
    }

    /**
     * @return array<int, AttachAction|AssociateAction>
     */
    private function attachOrAssociateActions(Table $table): array
    {
        return array_values(array_filter(
            $this->flattenActions($table->getHeaderActions()),
            fn ($action): bool => $action instanceof AttachAction || $action instanceof AssociateAction
        ));
    }

    /**
     * Whether an action has a URL configured, WITHOUT evaluating it. A url
     * closure for a row action typically expects a bound $record, which we
     * don't have here (no record is mounted); reading the underlying
     * property directly proves intent to navigate without risking a
     * TypeError from an unresolved closure parameter.
     */
    private function assertActionHasUrl(MountableAction $action, string $message): void
    {
        $property = new ReflectionProperty($action, 'url');
        $property->setAccessible(true);

        $this->assertNotNull($property->getValue($action), $message);
    }

    /**
     * Reads a header table action's mounted form field names via Filament's
     * own action-mounting lifecycle — the only way to observe a
     * `->form(fn (...) => [...])` closure's real output without
     * reimplementing Filament's own evaluation.
     *
     * @return array<int, string>
     */
    private function mountedActionFieldNames(Testable $component, string $actionName): array
    {
        $component->mountTableAction($actionName);
        $form = $component->instance()->getMountedTableActionForm();
        $fields = $form !== null ? array_keys($form->getFlatFields()) : [];
        $component->call('unmountTableAction', false, false);

        return $fields;
    }

    // ── Mounting ─────────────────────────────────────────────────────────────

    private function assertIsRealManager(string $class, array $config): void
    {
        $component = $this->mountManager($class, $config);
        $component->assertSuccessful();
        $this->assertInstanceOf(RelationManager::class, $component->instance());
    }

    private function mountManager(string $class, array $config): Testable
    {
        $user = $this->createCrudUser();
        $this->setCurrentPanel();

        [$owner, $pageClass] = $this->ownerFor($config['owner']);

        return Livewire::actingAs($user)->test($class, [
            'ownerRecord' => $owner,
            'pageClass' => $pageClass,
        ]);
    }

    /**
     * A single test case mounts the same manager class several times
     * (real-manager check, target check, shared-rules check, the pending
     * fully-compliant recheck...). Memoizing the owner record per test case
     * keeps every mount of a given manager pointed at the same host record,
     * and avoids re-running factories with fixed natural keys (Language's
     * `eng`) more than once per test.
     *
     * @var array<string, Model>
     */
    private array $ownerCache = [];

    /**
     * @return array{0: Model, 1: class-string}
     */
    private function ownerFor(string $owner): array
    {
        $pageClass = match ($owner) {
            'collection' => EditCollection::class,
            'item' => EditItem::class,
            'partner' => EditPartner::class,
            default => throw new InvalidArgumentException("Unknown owner resource [{$owner}]."),
        };

        $this->ownerCache[$owner] ??= match ($owner) {
            'collection' => $this->makeCollection(),
            'item' => $this->makeItem(),
            'partner' => $this->makePartner(),
        };

        return [$this->ownerCache[$owner], $pageClass];
    }

    private function makeCollection(): Collection
    {
        $context = Context::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        return Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
    }

    private function makeItem(): Item
    {
        return Item::factory()->Object()->create();
    }

    private function makePartner(): Partner
    {
        return Partner::factory()->create();
    }
}
