<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ItemResource\RelationManagers\ArtistsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\ChildItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\CollectionAppearancesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DocumentsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DynastiesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\IncomingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\OutgoingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\PictureItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TimelineEventsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\RelationManagers\LinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\VisitInformationRelationManager;
use Filament\Resources\RelationManagers\RelationGroup;
use Tests\TestCase;

/**
 * Asserts that Item relation managers are organized into the six selected RelationGroup tabs.
 *
 * Groups: Content, Media, Origin, Links, Timeline, Visit (M16 D1: a monument's visit information).
 * CollectionAppearancesRelationManager must appear in the Content group after PictureItemsRelationManager.
 * All previously registered relation managers must be reachable through a group.
 */
class ItemRelationGroupsTest extends TestCase
{
    /** @return array<int, RelationGroup> */
    private function getGroups(): array
    {
        return array_values(
            array_filter(
                ItemResource::getRelations(),
                fn (mixed $relation): bool => $relation instanceof RelationGroup
            )
        );
    }

    public function test_item_resource_returns_exactly_six_relation_groups(): void
    {
        $relations = ItemResource::getRelations();

        $groups = array_filter($relations, fn (mixed $r): bool => $r instanceof RelationGroup);

        $this->assertCount(6, $groups, 'ItemResource must return exactly 6 RelationGroup entries.');
    }

    public function test_item_resource_has_no_flat_relation_managers_outside_groups(): void
    {
        $relations = ItemResource::getRelations();

        $flat = array_filter($relations, fn (mixed $r): bool => is_string($r));

        $this->assertEmpty($flat, 'All Item relation managers must be inside a RelationGroup. Found flat entries: '.implode(', ', $flat));
    }

    public function test_item_relation_group_labels_are_correct(): void
    {
        $groups = $this->getGroups();

        $labels = array_map(fn (RelationGroup $g): string => $g->getLabel(), $groups);

        $this->assertSame(['Content', 'Media', 'Origin', 'Links', 'Timeline', 'Visit'], $labels);
    }

    public function test_content_group_contains_expected_managers_in_order(): void
    {
        $groups = $this->getGroups();
        $contentGroup = $groups[0];

        $this->assertSame('Content', $contentGroup->getLabel());

        $managers = $contentGroup->getManagers();

        $this->assertContains(ChildItemsRelationManager::class, $managers);
        $this->assertContains(TranslationsRelationManager::class, $managers);
        $this->assertContains(PictureItemsRelationManager::class, $managers);
        $this->assertContains(CollectionAppearancesRelationManager::class, $managers);
        $this->assertContains(TagsRelationManager::class, $managers);

        // Verify CollectionAppearancesRelationManager appears after PictureItemsRelationManager.
        $picturePos = array_search(PictureItemsRelationManager::class, $managers, true);
        $appearancesPos = array_search(CollectionAppearancesRelationManager::class, $managers, true);

        $this->assertGreaterThan(
            $picturePos,
            $appearancesPos,
            'CollectionAppearancesRelationManager must appear after PictureItemsRelationManager in the Content group.'
        );
    }

    public function test_media_group_contains_expected_managers(): void
    {
        $groups = $this->getGroups();
        $mediaGroup = $groups[1];

        $this->assertSame('Media', $mediaGroup->getLabel());

        $managers = $mediaGroup->getManagers();

        $this->assertSame(
            [ImagesRelationManager::class, LinksRelationManager::class, DocumentsRelationManager::class],
            $managers
        );
    }

    public function test_origin_group_contains_expected_managers(): void
    {
        $groups = $this->getGroups();
        $originGroup = $groups[2];

        $this->assertSame('Origin', $originGroup->getLabel());

        $managers = $originGroup->getManagers();

        $this->assertSame(
            [ArtistsRelationManager::class, DynastiesRelationManager::class],
            $managers
        );
    }

    public function test_links_group_contains_expected_managers(): void
    {
        $groups = $this->getGroups();
        $linksGroup = $groups[3];

        $this->assertSame('Links', $linksGroup->getLabel());

        $managers = $linksGroup->getManagers();

        $this->assertSame(
            [OutgoingLinksRelationManager::class, IncomingLinksRelationManager::class],
            $managers
        );
    }

    public function test_timeline_group_contains_expected_managers(): void
    {
        $groups = $this->getGroups();
        $timelineGroup = $groups[4];

        $this->assertSame('Timeline', $timelineGroup->getLabel());

        $managers = $timelineGroup->getManagers();

        $this->assertSame([TimelineEventsRelationManager::class], $managers);
    }

    public function test_visit_group_contains_the_visit_information_manager(): void
    {
        $groups = $this->getGroups();
        $visitGroup = $groups[5];

        $this->assertSame('Visit', $visitGroup->getLabel());
        $this->assertSame([VisitInformationRelationManager::class], $visitGroup->getManagers());
    }

    public function test_all_previously_registered_relation_managers_are_preserved(): void
    {
        $expected = [
            ChildItemsRelationManager::class,
            TranslationsRelationManager::class,
            PictureItemsRelationManager::class,
            CollectionAppearancesRelationManager::class,
            TagsRelationManager::class,
            ImagesRelationManager::class,
            LinksRelationManager::class,
            DocumentsRelationManager::class,
            ArtistsRelationManager::class,
            DynastiesRelationManager::class,
            OutgoingLinksRelationManager::class,
            IncomingLinksRelationManager::class,
            TimelineEventsRelationManager::class,
        ];

        $allManagers = [];
        foreach (ItemResource::getRelations() as $relation) {
            if ($relation instanceof RelationGroup) {
                foreach ($relation->getManagers() as $manager) {
                    $allManagers[] = $manager;
                }
            }
        }

        foreach ($expected as $managerClass) {
            $this->assertContains(
                $managerClass,
                $allManagers,
                "Relation manager {$managerClass} is missing from Item resource groups."
            );
        }
    }

    public function test_collection_appearances_is_in_content_group_not_standalone(): void
    {
        $relations = ItemResource::getRelations();

        // Must not appear as a flat entry.
        $this->assertNotContains(CollectionAppearancesRelationManager::class, $relations);

        // Must appear inside the Content group (first group).
        $groups = $this->getGroups();
        $contentManagers = $groups[0]->getManagers();

        $this->assertContains(CollectionAppearancesRelationManager::class, $contentManagers);
    }
}
