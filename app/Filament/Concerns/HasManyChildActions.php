<?php

namespace App\Filament\Concerns;

use App\Filament\Support\RecordSelect;
use App\Filament\Support\ResourceCreateUrl;
use Filament\Forms\Components\Component;
use Filament\Resources\Resource;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\AssociateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\DissociateAction;
use Filament\Tables\Actions\DissociateBulkAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * The generic has-many-children wiring shared by every relation manager of
 * the has-many convention (M7 epic #1871/#1872, story A1.1 — the
 * pattern-setter for A1.2/A1.3/A1.4).
 *
 * Header: `Create` (a URL action navigating to the child Resource's Create
 * page, the owning foreign key pre-filled via {@see ResourceCreateUrl}) ·
 * `Attach existing` (Filament's AssociateAction, routed through
 * {@see RecordSelect::recordSelectFor()}).
 * Row, in order: `View` · `Edit` (both navigate to the child Resource's
 * View/Edit page) · `Detach` (DissociateAction, clears the foreign key) ·
 * `Delete` (DeleteAction, the child's own policy).
 * Bulk: `Detach` (DissociateBulkAction).
 *
 * Every mutating action here is one of Filament's own built-ins
 * (AssociateAction, EditAction, DissociateAction, DeleteAction,
 * DissociateBulkAction), so {@see AuthorizesRelationMutations} — which every
 * concrete manager must also `use` — gates it automatically via its
 * canAssociate()/canEdit()/canDissociate()/canDelete()/canDissociateAny()
 * overrides. The header `Create` action is NOT one of Filament's built-ins
 * (it navigates rather than opening a modal), so it is gated explicitly here
 * via `$this->canCreate()`, per AuthorizesRelationMutations' own contract for
 * custom actions.
 *
 * A concrete manager declares only its specifics: the child Resource class,
 * the owning foreign key, the RecordSelect entity, and — optionally — extra
 * fixed Create pre-fill values and/or an Attach-existing cycle guard.
 *
 * @template TModel of Model
 */
trait HasManyChildActions
{
    /**
     * The child Resource class the header `Create`/row `View`/`Edit` actions
     * navigate to (e.g. CollectionResource::class).
     *
     * @return class-string<\Filament\Resources\Resource>
     */
    abstract protected static function hasManyChildResource(): string;

    /**
     * The column on the child model that stores the owning foreign key (e.g.
     * `parent_id`, `partner_id`). Both the header `Create` pre-fill and the
     * `Attach existing`/`Detach` semantics revolve around this column.
     */
    abstract protected static function hasManyChildForeignKey(): string;

    /**
     * One of the RecordSelect::ITEMS / ::COLLECTIONS / ... constants, for the
     * `Attach existing` action's record select.
     */
    abstract protected static function hasManyChildRecordSelectEntity(): string;

    /**
     * Extra fixed query-string values for the header `Create` action's
     * {@see ResourceCreateUrl}, beyond the owning foreign key — e.g.
     * `['type' => 'picture']` for A1.3's picture items. Empty by default.
     *
     * @return array<string, scalar>
     */
    protected static function hasManyChildCreateExtra(): array
    {
        return [];
    }

    /**
     * The name of the `BelongsTo` relation on the CHILD model that points
     * back at the owner (e.g. Collection::parent(), Item::partner()) —
     * required by Filament's AssociateAction/DissociateAction to resolve
     * `$child->{inverse}()` themselves. Filament's own default guess (the
     * owner model's basename, e.g. "collection") only matches when a relation
     * is actually named after its related model, which none of this
     * convention's inverses are. Defaults to the foreign key with its `_id`
     * suffix stripped (`parent_id` → `parent`, `partner_id` → `partner`),
     * overridable when that doesn't match.
     */
    protected static function hasManyChildInverseRelationship(): string
    {
        return Str::beforeLast(static::hasManyChildForeignKey(), '_id');
    }

    /**
     * Optional narrowing applied to the `Attach existing` select's options
     * query — e.g. A1.1's cycle guard, {@see RecordSelect::excludingAncestorsOf()}.
     * A no-op by default.
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    protected function hasManyChildAssociateScope(Builder $query): Builder
    {
        return $query;
    }

    /**
     * Extra form components appended after the `Attach existing` record
     * select — e.g. A1.4's reactive placeholder naming an item's current
     * partner before re-assigning it, so the admin sees who they're taking
     * the record away from. Empty by default, in which case the select is
     * left exactly as Filament/{@see RecordSelect::recordSelectFor()} built
     * it. When non-empty, the select is additionally marked `->live()` so the
     * extra components can react to it via `Get`.
     *
     * @return array<int, Component>
     */
    protected function hasManyChildAssociateFormExtra(): array
    {
        return [];
    }

    /**
     * @return array<int, Action|AssociateAction>
     */
    protected function hasManyChildHeaderActions(): array
    {
        $resource = static::hasManyChildResource();
        $foreignKey = static::hasManyChildForeignKey();
        $owner = $this->getOwnerRecord();

        $associate = RecordSelect::recordSelectFor(
            AssociateAction::make()->label('Attach existing'),
            static::hasManyChildRecordSelectEntity(),
            fn (Builder $query): Builder => $this->hasManyChildAssociateScope($query)
        );

        $associateFormExtra = $this->hasManyChildAssociateFormExtra();

        if ($associateFormExtra !== []) {
            $associate = $associate->form(fn (): array => [
                $associate->getRecordSelect()->live(),
                ...$associateFormExtra,
            ]);
        }

        return [
            Action::make('create')
                ->label('Create')
                ->icon('heroicon-o-plus')
                ->url(fn (): string => ResourceCreateUrl::for($resource, [
                    $foreignKey => $owner->getKey(),
                    ...static::hasManyChildCreateExtra(),
                ]))
                ->visible(fn (): bool => $this->canCreate()),

            $associate,
        ];
    }

    /**
     * @return array<int, Action>
     */
    protected function hasManyChildRowActions(): array
    {
        $resource = static::hasManyChildResource();

        return [
            ViewAction::make()
                ->url(fn (Model $record): ?string => auth()->user()?->can('view', $record)
                    ? $resource::getUrl('view', ['record' => $record])
                    : null),

            EditAction::make()
                ->url(fn (Model $record): string => $resource::getUrl('edit', ['record' => $record])),

            DissociateAction::make()->label('Detach'),

            DeleteAction::make(),
        ];
    }

    /**
     * @return array<int, DissociateBulkAction>
     */
    protected function hasManyChildBulkActions(): array
    {
        return [
            DissociateBulkAction::make(),
        ];
    }

    /**
     * Applies every piece of has-many-children wiring to a table already
     * carrying its own columns/query/sort/pagination: the inverse
     * relationship AssociateAction/DissociateAction need, and the header/row/
     * bulk actions above. A concrete manager's `table()` calls this last.
     */
    protected function hasManyChildConfigureTable(Table $table): Table
    {
        return $table
            ->inverseRelationship(static::hasManyChildInverseRelationship())
            ->headerActions($this->hasManyChildHeaderActions())
            ->actions($this->hasManyChildRowActions())
            ->bulkActions($this->hasManyChildBulkActions());
    }
}
