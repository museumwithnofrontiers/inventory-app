<?php

namespace Tests\Filament;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ChildCollectionsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\ImagesRelationManager as CollectionImagesRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager as CollectionItemsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\PartnersRelationManager as CollectionPartnersRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\TranslationsRelationManager as CollectionTranslationsRelationManager;
use App\Filament\Resources\CollectionTranslationResource\Pages\EditCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\RelationManagers\SiblingTranslationsRelationManager as CollectionTranslationSiblingTranslationsRelationManager;
use App\Filament\Resources\CountryResource\Pages\EditCountry;
use App\Filament\Resources\CountryResource\RelationManagers\TranslationsRelationManager as CountryTranslationsRelationManager;
use App\Filament\Resources\GlossaryResource\Pages\EditGlossary;
use App\Filament\Resources\GlossaryResource\RelationManagers\SpellingsRelationManager as GlossarySpellingsRelationManager;
use App\Filament\Resources\GlossaryResource\RelationManagers\SynonymsRelationManager as GlossarySynonymsRelationManager;
use App\Filament\Resources\GlossaryResource\RelationManagers\TranslationsRelationManager as GlossaryTranslationsRelationManager;
use App\Filament\Resources\ItemItemLinkResource\Pages\EditItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\RelationManagers\TranslationsRelationManager as ItemItemLinkTranslationsRelationManager;
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
use App\Filament\Resources\ItemTranslationResource\Pages\EditItemTranslation;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\SiblingTranslationsRelationManager as ItemTranslationSiblingTranslationsRelationManager;
use App\Filament\Resources\LanguageResource\Pages\EditLanguage;
use App\Filament\Resources\LanguageResource\RelationManagers\TranslationsRelationManager as LanguageTranslationsRelationManager;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\CollectionParticipationsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\ImagesRelationManager as PartnerImagesRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\OwnedItemsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\TranslationsRelationManager as PartnerTranslationsRelationManager;
use App\Filament\Resources\PartnerTranslationResource\Pages\EditPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\RelationManagers\ImagesRelationManager as PartnerTranslationImagesRelationManager;
use App\Filament\Resources\PartnerTranslationResource\RelationManagers\SiblingTranslationsRelationManager as PartnerTranslationSiblingTranslationsRelationManager;
use App\Filament\Resources\ProjectResource\Pages\EditProject;
use App\Filament\Resources\ProjectResource\RelationManagers\CollectionsRelationManager as ProjectCollectionsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\ItemsRelationManager as ProjectItemsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\PartnersRelationManager as ProjectPartnersRelationManager;
use App\Filament\Resources\RoleResource\Pages\EditRole;
use App\Filament\Resources\RoleResource\RelationManagers\PermissionsRelationManager;
use App\Filament\Resources\RoleResource\RelationManagers\UsersRelationManager;
use App\Filament\Resources\TimelineEventResource\Pages\EditTimelineEvent;
use App\Filament\Resources\TimelineEventResource\RelationManagers\ImagesRelationManager as TimelineEventImagesRelationManager;
use App\Filament\Resources\TimelineEventResource\RelationManagers\ItemsRelationManager as TimelineEventItemsRelationManager;
use App\Filament\Resources\TimelineEventResource\RelationManagers\TranslationsRelationManager as TimelineEventTranslationsRelationManager;
use App\Filament\Resources\TimelineResource\Pages\EditTimeline;
use App\Filament\Resources\TimelineResource\RelationManagers\EventsRelationManager as TimelineEventsRelationManagerForTimeline;
use App\Models\Collection;
use App\Models\CollectionTranslation;
use App\Models\Context;
use App\Models\Country;
use App\Models\Glossary;
use App\Models\Item;
use App\Models\ItemItemLink;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\Partner;
use App\Models\PartnerTranslation;
use App\Models\Project;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use App\Models\User;
use Filament\Actions\ActionGroup as BaseActionGroup;
use Filament\Actions\MountableAction;
use Filament\Resources\RelationManagers\RelationGroup;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Resources\Resource;
use Filament\Tables\Actions\AssociateAction;
use Filament\Tables\Actions\AttachAction;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use PHPUnit\Framework\Assert;
use PHPUnit\Framework\AssertionFailedError;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionClass;
use ReflectionProperty;
use Spatie\Permission\Models\Role;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A0.5 (epic #1871), extended panel-wide by Story A5.1 (epic #1876).
 *
 * Iterates every relation manager registered via getRelations() on every
 * Resource the admin panel discovers (RelationGroups flattened — see
 * {@see self::allManagers()}) and classifies each into exactly one kind:
 *
 * - has-many:      a child row carries the owner's FK. Header: Create
 *                  (navigates to the child Resource) + Attach existing. Row:
 *                  view/edit/dissociate/delete. Bulk: dissociate.
 * - pivot:         a many-to-many relation, optionally with its own metadata
 *                  columns. Header: Attach. Row: view/(edit)/detach. Bulk:
 *                  detach.
 * - translations:  the owner-side manager listing a Collection/Item/Partner's
 *                  own translations, each of which has its own
 *                  TranslationResource. Header: create (navigates there) +
 *                  createDefaultTranslation. Row: viewTranslation,
 *                  editTranslation, viewParent(Owner), delete.
 * - inline:        Item Media and Item Documents — no Resource exists for
 *                  either, so Create/Edit stay inline modals.
 * - pinned:        no convention fits (a Base*RelationManager shared by
 *                  several resources whose shape isn't one of the above, a
 *                  read-only rollup, a relation with no Resource of its own
 *                  to navigate to, or a manager Pascal named directly — Role
 *                  permissions/users). No story migrates these; their CURRENT
 *                  action names/order are pinned exactly as-is. Each entry's
 *                  comment says why no convention applies.
 *
 * self::PENDING lists every has-many/pivot/translations/inline manager that
 * doesn't yet meet its kind's full target. self::PINNED_PENDING lists every
 * pinned manager that doesn't yet meet the shared rules below (a pinned
 * manager's action shape is never pending — only its compliance with the
 * shared rules can be). Each alignment story removes its own manager(s) from
 * whichever list it's on; both lists being empty is part of the milestone's
 * DoD.
 *
 * Per manager (data-provider driven, one case per manager):
 * - Not pending, not pinned-pending: must fully meet its target, including
 *   the shared rules below. This is the acceptance: removing an entry without
 *   implementing the convention fails the test.
 * - Pending: only asserted to be a real, registered manager, AND asserted to
 *   NOT already fully meet its target plus the shared rules (a stale
 *   compliant entry left on the list also fails the test).
 * - Pinned-pending: same as pending, but for a pinned manager — asserted to
 *   NOT already meet its pinned snapshot plus the shared rules.
 * - Unclassified (not in self::CLASSIFICATION): fails with a clear message.
 *
 * Shared rules, asserted on every non-pending, non-pinned-pending manager
 * (all kinds, including pinned): AuthorizesRelationMutations is used; every
 * record select comes from RecordSelect (source + behaviour checks, see
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
     * Every relation manager registered on the admin panel (see
     * {@see self::allManagers()}), classified into exactly one kind. A
     * manager registered via getRelations() but missing here fails the test
     * with a clear message (see {@see self::classify()}).
     *
     * @var array<class-string, array<string, mixed>>
     */
    private const CLASSIFICATION = [
        // ── has-many ──────────────────────────────────────────────────
        ChildCollectionsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'collection'],
        ChildItemsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'item'],
        PictureItemsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'item'],
        OwnedItemsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'partner'],
        ProjectItemsRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'project'],
        ProjectPartnersRelationManager::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'project'],
        TimelineEventsRelationManagerForTimeline::class => ['kind' => self::KIND_HAS_MANY, 'owner' => 'timeline'],

        // ── pivot ─────────────────────────────────────────────────────
        CollectionItemsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'collection', 'edit' => true, 'extraRow' => ['view_appearance']],
        CollectionPartnersRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'collection', 'edit' => true],
        CollectionAppearancesRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => true, 'extraRow' => ['view_appearance']],
        TagsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => false],
        ArtistsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => false],
        WorkshopsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => false],
        DynastiesRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => false],
        TimelineEventsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'item', 'edit' => true, 'bcColumn' => true],
        CollectionParticipationsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'partner', 'edit' => true],
        TimelineEventItemsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'timelineevent', 'edit' => true, 'bcColumn' => true],
        GlossarySynonymsRelationManager::class => ['kind' => self::KIND_PIVOT, 'owner' => 'glossary', 'edit' => false],

        // ── translations ──────────────────────────────────────────────
        CollectionTranslationsRelationManager::class => ['kind' => self::KIND_TRANSLATIONS, 'owner' => 'collection', 'viewParent' => 'viewParentCollection'],
        ItemTranslationsRelationManager::class => ['kind' => self::KIND_TRANSLATIONS, 'owner' => 'item', 'viewParent' => 'viewParentItem'],
        PartnerTranslationsRelationManager::class => ['kind' => self::KIND_TRANSLATIONS, 'owner' => 'partner', 'viewParent' => 'viewParentPartner'],

        // ── inline ────────────────────────────────────────────────────
        MediaRelationManager::class => ['kind' => self::KIND_INLINE, 'owner' => 'item', 'variant' => 'media'],
        DocumentsRelationManager::class => ['kind' => self::KIND_INLINE, 'owner' => 'item', 'variant' => 'documents'],

        // ── pinned: the three original Images managers + the two Item Links managers ──
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

        // ── pinned: BaseImagesRelationManager on other resources — same shape as the three above ──
        PartnerTranslationImagesRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'partnertranslation',
            'pinnedHeader' => ['attach'], 'pinnedRow' => ['view_image', 'download', 'edit', 'detach', 'delete'], 'pinnedBulk' => [],
        ],
        TimelineEventImagesRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'timelineevent',
            'pinnedHeader' => ['attach'], 'pinnedRow' => ['view_image', 'download', 'edit', 'detach', 'delete'], 'pinnedBulk' => [],
        ],

        // ── pinned: BaseSiblingTranslationsRelationManager — shared base class, its own read-only shape ──
        CollectionTranslationSiblingTranslationsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'collectiontranslation',
            'pinnedHeader' => [], 'pinnedRow' => ['viewTranslation', 'editTranslation'], 'pinnedBulk' => [],
        ],
        ItemTranslationSiblingTranslationsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'itemtranslation',
            'pinnedHeader' => [], 'pinnedRow' => ['viewTranslation', 'editTranslation'], 'pinnedBulk' => [],
        ],
        PartnerTranslationSiblingTranslationsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'partnertranslation',
            'pinnedHeader' => [], 'pinnedRow' => ['viewTranslation', 'editTranslation'], 'pinnedBulk' => [],
        ],

        // ── pinned: translation-shaped, but no *TranslationResource exists to navigate to — inline Create/Edit stays ──
        CountryTranslationsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'country',
            'pinnedHeader' => ['create'], 'pinnedRow' => ['edit', 'delete'], 'pinnedBulk' => [],
        ],
        LanguageTranslationsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'language',
            'pinnedHeader' => ['create'], 'pinnedRow' => ['edit', 'delete'], 'pinnedBulk' => [],
        ],
        GlossaryTranslationsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'glossary',
            'pinnedHeader' => ['create'], 'pinnedRow' => ['edit', 'delete'], 'pinnedBulk' => [],
        ],
        GlossarySpellingsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'glossary',
            'pinnedHeader' => ['create'], 'pinnedRow' => ['edit', 'delete'], 'pinnedBulk' => [],
        ],
        ItemItemLinkTranslationsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'itemitemlink',
            'pinnedHeader' => ['create'], 'pinnedRow' => ['view', 'edit', 'delete'], 'pinnedBulk' => [],
        ],
        TimelineEventTranslationsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'timelineevent',
            'pinnedHeader' => ['create'], 'pinnedRow' => ['edit', 'delete'], 'pinnedBulk' => [],
        ],

        // ── pinned: Project's rollup of the collections that appear via its own items — a derived,
        // read-only BelongsToMany over the items table (no collection_project pivot), not a real FK
        // relation, so nothing here can genuinely be attached/detached ──
        ProjectCollectionsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'project',
            'pinnedHeader' => [], 'pinnedRow' => [], 'pinnedBulk' => [],
        ],

        // ── pinned: Role permissions/users — named directly by Pascal (2026-09-27); Spatie's
        // Permission/User models have no *DisplayLabel/RecordSelect entity and Permission has no
        // Resource of its own to navigate to ──
        PermissionsRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'role',
            'pinnedHeader' => ['attach', 'createPermission'], 'pinnedRow' => ['edit', 'detach', 'deletePermission'], 'pinnedBulk' => [],
        ],
        UsersRelationManager::class => [
            'kind' => self::KIND_PINNED, 'owner' => 'role',
            'pinnedHeader' => [], 'pinnedRow' => [], 'pinnedBulk' => [],
        ],
    ];

    /**
     * Managers that don't yet meet their kind's full target plus the shared
     * rules. Each alignment story removes its own entry as part of its PR;
     * the milestone's DoD is this list being empty.
     *
     * @var array<int, class-string>
     */
    private const PENDING = [
        // has-many, but currently a read-only listing (no actions at all)
        ProjectItemsRelationManager::class,
        ProjectPartnersRelationManager::class,

        // has-many-shaped, but timeline_events.timeline_id is NOT NULL — the alignment story
        // must resolve what "detach" means (or doesn't) for a required parent
        TimelineEventsRelationManagerForTimeline::class,

        // pivot, but attaches via its own recordSelectSearchColumns()/recordSelectOptionsQuery()
        // instead of RecordSelect::recordSelectFor(), and has no 'view' row action
        GlossarySynonymsRelationManager::class,
    ];

    /**
     * Pinned managers that don't yet meet the shared rules (their pinned
     * action shape is exempt from ever changing, but AuthorizesRelationMutations,
     * the RecordSelect rule, and the pagination rule are not). A pinned
     * manager is never on self::PENDING — this is its equivalent. Each
     * alignment story removes its own entry as part of its PR; the
     * milestone's DoD is this list being empty too.
     *
     * @var array<int, class-string>
     */
    private const PINNED_PENDING = [
        // missing AuthorizesRelationMutations
        CountryTranslationsRelationManager::class,
        LanguageTranslationsRelationManager::class,
        GlossaryTranslationsRelationManager::class,
        GlossarySpellingsRelationManager::class,
        ItemItemLinkTranslationsRelationManager::class,
        TimelineEventTranslationsRelationManager::class,
        ProjectCollectionsRelationManager::class,
        UsersRelationManager::class,

        // missing AuthorizesRelationMutations; AttachAction preloads its record select
        // (preloadRecordSelect()) and builds it directly instead of via RecordSelect::recordSelectFor()
        PermissionsRelationManager::class,
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
     * Every relation manager currently registered on the admin panel,
     * discovered from each registered Resource's own getRelations() rather
     * than a hardcoded manager list — so a manager added later without
     * updating self::CLASSIFICATION is caught by {@see self::classify()}
     * instead of silently skipped.
     *
     * @return array<int, class-string>
     */
    private static function allManagers(): array
    {
        $managers = [];

        foreach (self::allResources() as $resourceClass) {
            $managers = [...$managers, ...self::flattenRelations($resourceClass::getRelations())];
        }

        return array_values(array_unique($managers));
    }

    /**
     * Every Resource class the admin panel registers, i.e. what
     * `Filament::getPanel('admin')->getResources()` returns — read directly
     * off disk instead of through the Filament facade, because
     * self::allManagers() backs a static #[DataProvider]: PHPUnit calls a
     * data provider while building the test suite, before the Laravel
     * application (and so the Filament facade) has booted. AdminPanelProvider
     * registers every Resource via `discoverResources(in:
     * app_path('Filament/Resources'), for: 'App\Filament\Resources')` — a
     * flat, non-recursive scan of that one directory, which this mirrors
     * exactly via glob() so it stays in sync automatically as resources are
     * added or removed.
     *
     * @return array<int, class-string<\Filament\Resources\Resource>>
     */
    private static function allResources(): array
    {
        $directory = dirname(__DIR__, 2).'/app/Filament/Resources';
        $classes = [];

        foreach (glob($directory.'/*Resource.php') ?: [] as $file) {
            $class = 'App\\Filament\\Resources\\'.basename($file, '.php');

            if (is_subclass_of($class, Resource::class)) {
                $classes[] = $class;
            }
        }

        sort($classes);

        return $classes;
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
            if (in_array($managerClass, self::PINNED_PENDING, true)) {
                $this->assertIsRealManager($managerClass, $config);
                $this->assertFalse(
                    $this->fullyCompliant($managerClass, $config),
                    "{$managerClass} is on the pinned-pending allow-list but already fully meets its pinned snapshot ".
                    'plus the shared rules — remove it from RelationManagerConventionTest::PINNED_PENDING.'
                );

                return;
            }

            // A pinned manager not on PINNED_PENDING must always match its
            // current snapshot exactly, plus the shared rules.
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

    public function test_pending_and_pinned_pending_allow_lists_only_name_registered_managers_of_the_right_kind(): void
    {
        $allManagers = self::allManagers();

        $unknownPending = array_diff(self::PENDING, $allManagers);
        $this->assertSame(
            [],
            array_values($unknownPending),
            'RelationManagerConventionTest::PENDING references manager(s) that are not registered on the admin panel: '.implode(', ', $unknownPending)
        );

        $unknownPinnedPending = array_diff(self::PINNED_PENDING, $allManagers);
        $this->assertSame(
            [],
            array_values($unknownPinnedPending),
            'RelationManagerConventionTest::PINNED_PENDING references manager(s) that are not registered on the admin panel: '.implode(', ', $unknownPinnedPending)
        );

        // A pinned manager's action shape is never pending — only PINNED_PENDING applies to it —
        // and a pending manager (has-many/pivot/translations/inline) is never pinned.
        foreach (self::PENDING as $class) {
            $this->assertNotSame(
                self::KIND_PINNED,
                $this->classify($class)['kind'],
                "{$class} is classified pinned but listed on RelationManagerConventionTest::PENDING — a pinned manager belongs on PINNED_PENDING instead."
            );
        }

        foreach (self::PINNED_PENDING as $class) {
            $this->assertSame(
                self::KIND_PINNED,
                $this->classify($class)['kind'],
                "{$class} is on RelationManagerConventionTest::PINNED_PENDING but isn't classified pinned — a non-pinned manager belongs on PENDING instead."
            );
        }
    }

    public function test_the_admin_panel_registers_the_expected_number_of_relation_managers(): void
    {
        // 7 has-many + 11 pivot + 3 translations + 2 inline + 19 pinned = 42.
        // A change here means a manager was added or removed on some Resource
        // registered on the admin panel — classify it in
        // self::CLASSIFICATION (and, if it isn't yet convention-compliant,
        // list it on self::PENDING or self::PINNED_PENDING) rather than
        // letting this count silently drift.
        $this->assertCount(42, self::allManagers());
    }

    private function classify(string $class): array
    {
        $config = self::CLASSIFICATION[$class] ?? null;

        if ($config === null) {
            Assert::fail(
                "Relation manager [{$class}] is registered via getRelations() on a Resource the admin panel discovers ".
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
            default => Assert::fail("{$class}: unknown kind [{$config['kind']}] in RelationManagerConventionTest::CLASSIFICATION."),
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
            default => Assert::fail("{$class}: unknown inline variant [{$config['variant']}] in RelationManagerConventionTest::CLASSIFICATION."),
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
        $this->assertContains('language_id', $fields, "{$class}: the inline Create/Edit form must include a language field, 'language_id' (#1908).");
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
            $this->assertPivotBackwardCompatibilityRule($component, $table, $class, $config);
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
     * The pivot column's toggle state, the attach form, AND (M7 story A2.3,
     * #1902) the edit-pivot modal, which needs a real attached record to
     * mount 'edit' on (it's a row action) — built here via the manager's own
     * relationship, off the same cached owner record every other check in
     * this test case already mounted against.
     */
    private function assertPivotBackwardCompatibilityRule(Testable $component, Table $table, string $class, array $config): void
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

        [$owner] = $this->ownerFor($config['owner']);
        $relationshipName = $this->relationshipNameOf($class);
        /** @var BelongsToMany<Model, Model> $relation */
        $relation = $owner->{$relationshipName}();
        $relatedRecord = $relation->getRelated()::factory()->create(); // @phpstan-ignore staticMethod.notFound (HasFactory is on every concrete model here, just not on the generic Model type)
        $relation->attach($relatedRecord->getKey());

        $editFields = $this->mountedActionFieldNames($component, 'edit', $relatedRecord);
        $this->assertNotContains('backward_compatibility', $editFields, "{$class}: the edit-pivot modal must not expose backward_compatibility (importer-owned).");
    }

    /**
     * Reads a relation manager class's own `protected static string
     * $relationship` without instantiating it.
     */
    private function relationshipNameOf(string $class): string
    {
        $property = new ReflectionProperty($class, 'relationship');
        $property->setAccessible(true);

        /** @var string */
        return $property->getValue();
    }

    // ── Action introspection helpers ─────────────────────────────────────────

    /**
     * Flattens header/row/bulk action definitions, expanding any
     * ActionGroup/BulkActionGroup in place, mirroring how Filament's own
     * `assertTableActionsExistInOrder()` flattens groups before comparing.
     *
     * @param  array<int|string, mixed>  $definitions
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
     * Reads a table action's mounted form field names via Filament's own
     * action-mounting lifecycle — the only way to observe a
     * `->form(fn (...) => [...])` closure's real output without
     * reimplementing Filament's own evaluation. $record is required for a
     * row action (e.g. 'edit') and omitted for a header action (e.g.
     * 'attach').
     *
     * @return array<int, string>
     */
    private function mountedActionFieldNames(Testable $component, string $actionName, ?Model $record = null): array
    {
        $component->mountTableAction($actionName, $record);
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
        $user = $this->userFor($config['owner']);
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
            'project' => EditProject::class,
            'timeline' => EditTimeline::class,
            'timelineevent' => EditTimelineEvent::class,
            'country' => EditCountry::class,
            'language' => EditLanguage::class,
            'glossary' => EditGlossary::class,
            'role' => EditRole::class,
            'itemitemlink' => EditItemItemLink::class,
            'collectiontranslation' => EditCollectionTranslation::class,
            'itemtranslation' => EditItemTranslation::class,
            'partnertranslation' => EditPartnerTranslation::class,
            default => throw new InvalidArgumentException("Unknown owner resource [{$owner}]."),
        };

        $this->ownerCache[$owner] ??= match ($owner) {
            'collection' => $this->makeCollection(),
            'item' => $this->makeItem(),
            'partner' => $this->makePartner(),
            'project' => $this->makeProject(),
            'timeline' => $this->makeTimeline(),
            'timelineevent' => $this->makeTimelineEvent(),
            'country' => $this->makeCountry(),
            'language' => $this->makeLanguage(),
            'glossary' => $this->makeGlossary(),
            'role' => $this->makeRole(),
            'itemitemlink' => $this->makeItemItemLink(),
            'collectiontranslation' => $this->makeCollectionTranslation(),
            'itemtranslation' => $this->makeItemTranslation(),
            'partnertranslation' => $this->makePartnerTranslation(),
        };

        return [$this->ownerCache[$owner], $pageClass];
    }

    /**
     * The user a manager is mounted as. Country, Language and Glossary sit
     * behind Tier-2 `manage-reference-data` rather than the ordinary CRUD
     * permissions (see their Policies' viewAny()), and Role sits behind its
     * own `manage-roles` — both gate every ability on that one permission, so
     * {@see InteractsWithAdminPanel}'s matching helper covers create/update/
     * delete too. Every other owner's Policy uses the ordinary view/create/
     * update/delete-data permissions createCrudUser() already grants.
     */
    private function userFor(string $owner): User
    {
        return match ($owner) {
            'country', 'language', 'glossary' => $this->createReferenceDataUser(),
            'role' => $this->createRoleManagerUser(),
            default => $this->createCrudUser(),
        };
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

    private function makeProject(): Project
    {
        return Project::factory()->create();
    }

    private function makeTimeline(): Timeline
    {
        return Timeline::factory()->create();
    }

    private function makeTimelineEvent(): TimelineEvent
    {
        return TimelineEvent::factory()->create();
    }

    private function makeCountry(): Country
    {
        return Country::factory()->create();
    }

    private function makeLanguage(): Language
    {
        return Language::factory()->create();
    }

    private function makeGlossary(): Glossary
    {
        return Glossary::factory()->create();
    }

    private function makeRole(): Role
    {
        /** @var Role $role */
        $role = Role::create([
            'name' => 'Test role '.Str::random(8),
            'guard_name' => config('fortify.guard', 'web'),
        ]);

        return $role;
    }

    private function makeItemItemLink(): ItemItemLink
    {
        return ItemItemLink::factory()->create();
    }

    private function makeCollectionTranslation(): CollectionTranslation
    {
        return CollectionTranslation::factory()->create();
    }

    private function makeItemTranslation(): ItemTranslation
    {
        return ItemTranslation::factory()->create();
    }

    private function makePartnerTranslation(): PartnerTranslation
    {
        return PartnerTranslation::factory()->create();
    }
}
