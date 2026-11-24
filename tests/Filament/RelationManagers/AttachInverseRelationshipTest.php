<?php

namespace Tests\Filament\RelationManagers;

use Filament\Actions\AttachAction;
use Filament\Facades\Filament;
use Filament\Resources\RelationManagers\RelationGroup;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Resources\RelationManagers\RelationManagerConfiguration;
use Filament\Resources\Resource;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * An Attach action leaves out the records already attached by querying the
 * table's inverse relationship (the related model's way back to the owner).
 * Filament guesses its name from the owner's class unless the table names
 * it, and Filament 4 runs that query whenever the picked record is checked,
 * so a wrong or missing inverse relationship breaks the action.
 */
class AttachInverseRelationshipTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_every_attach_action_has_an_inverse_relationship(): void
    {
        $this->setCurrentPanel();
        $user = $this->createCrudUser();
        $failures = [];
        $checked = 0;

        foreach (Filament::getPanel('admin')->getResources() as $resource) {
            /** @var class-string<resource> $resource */
            $pages = $resource::getPages();
            $pageRegistration = $pages['view'] ?? $pages['edit'] ?? null;

            // Every data model has a factory; the role list is read-only
            if ($pageRegistration === null || ! method_exists($resource::getModel(), 'factory')) {
                continue;
            }

            foreach ($this->relationManagers($resource) as $manager) {
                /** @var class-string<Model> $model */
                $model = $resource::getModel();
                $owner = $model::factory()->create();
                $this->actingAs($user);

                if (! $manager::canViewForRecord($owner, $pageRegistration->getPage())) {
                    continue;
                }

                $instance = Livewire::actingAs($user)
                    ->test($manager, ['ownerRecord' => $owner, 'pageClass' => $pageRegistration->getPage()])
                    ->instance();

                if (! $instance instanceof RelationManager) {
                    $failures[] = "{$manager}: did not mount";

                    continue;
                }

                $table = $instance->getTable();
                $relationship = $table->getRelationship();

                if (! $relationship instanceof BelongsToMany || $table->allowsDuplicates()) {
                    continue;
                }

                $hasAttach = collect($table->getHeaderActions())
                    ->flatMap(fn ($action) => method_exists($action, 'getFlatActions') ? $action->getFlatActions() : [$action])
                    ->contains(fn ($action) => $action instanceof AttachAction);

                if (! $hasAttach) {
                    continue;
                }

                $checked++;
                $inverse = $table->getInverseRelationshipName();
                $related = $relationship->getRelated();

                if (! method_exists($related, (string) $inverse) || ! $related->{$inverse}() instanceof Relation) {
                    $failures[] = "{$manager}: ".$related::class."::{$inverse}() is not a relationship";
                }
            }
        }

        $this->assertGreaterThan(0, $checked);
        $this->assertEmpty($failures, implode("\n", $failures));
    }

    /**
     * @param  class-string<resource>  $resource
     * @return array<class-string<RelationManager>>
     */
    private function relationManagers(string $resource): array
    {
        $managers = [];

        foreach ($resource::getRelations() as $relation) {
            $items = $relation instanceof RelationGroup ? $relation->getManagers() : [$relation];

            foreach ($items as $item) {
                $managers[] = $item instanceof RelationManagerConfiguration ? $item->relationManager : $item;
            }
        }

        return array_values(array_unique($managers));
    }
}
