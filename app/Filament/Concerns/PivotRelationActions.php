<?php

namespace App\Filament\Concerns;

use App\Filament\Support\RecordSelect;
use Closure;
use Filament\Forms\Components\Component;
use Filament\Resources\Resource;
use Filament\Tables\Actions\AssociateAction;
use Filament\Tables\Actions\AttachAction;
use Filament\Tables\Actions\DetachAction;
use Filament\Tables\Actions\DetachBulkAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Illuminate\Database\Eloquent\Model;

/**
 * The pivot relation manager convention's generic action wiring (M7 epic
 * #1873, pattern-setter story A2.1 / #1900): header `attach` (RecordSelect +
 * pivot metadata fields), row `view` (related record) / `edit` (pivot
 * metadata only) / `detach`, bulk `detach`. A2.2-A2.4 reuse this concern
 * unchanged, declaring only their RecordSelect entity, pivot fields schema
 * and related Resource — the same three things this trait's methods are
 * parameterised by.
 *
 * Authorization is untouched by this concern. Every relation manager using it
 * must also `use AuthorizesRelationMutations`:
 * - `pivotAttachAction()` returns Filament's own AttachAction, so its
 *   visibility is `canAttach()` (host record `update` only).
 * - `pivotEditAction()` returns Filament's own EditAction. On a BelongsToMany
 *   relation manager Filament already splits submitted form data between the
 *   pivot (`$relationship->getPivotColumns()`) and the related record itself
 *   (see `EditAction::setUp()`), so as long as $pivotFields names only pivot
 *   columns the related record's own columns are never written. Its
 *   visibility is `canEdit()` (host record `update`, plus the related
 *   record's own `update` where it has a policy — see that trait's docblock;
 *   for Collection/Item both resolve to the same `update-data` permission).
 * - `pivotDetachAction()`/`pivotDetachBulkAction()` return Filament's own
 *   Detach actions, gated by `canDetach()`/`canDetachAny()` (host record
 *   `update` only).
 * - `pivotViewAction()` returns Filament's own ViewAction with its default
 *   modal replaced by a link to the related record's Resource View page.
 *   AuthorizesRelationMutations does not override `canView()`, so Filament's
 *   own default (RelationManager::canView() — the related record's own
 *   `view` ability) governs it, which is correct for a non-mutating action.
 */
trait PivotRelationActions
{
    /**
     * The header `attach` action: a RecordSelect-wired AttachAction (search,
     * labels, order, the 50-result cap — never preloaded) whose form appends
     * $pivotFields after the record select itself.
     *
     * $scope, when given, narrows the record select's options query — e.g.
     * A2.2's Partner-side Attach restricted to `Collection::scopeCollections()`
     * — and is passed straight through to
     * {@see RecordSelect::recordSelectFor()}.
     *
     * @param  array<int, Component>  $pivotFields
     */
    protected function pivotAttachAction(string $recordSelectEntity, array $pivotFields, ?Closure $scope = null): AttachAction|AssociateAction
    {
        return RecordSelect::recordSelectFor(AttachAction::make(), $recordSelectEntity, $scope)
            ->form(fn (AttachAction $action): array => [
                $action->getRecordSelect(),
                ...$pivotFields,
            ]);
    }

    /**
     * The row `view` action: navigates to the related record's own Resource
     * View page instead of opening ViewAction's default read-only modal.
     *
     * @param  class-string<\Filament\Resources\Resource>  $relatedResourceClass
     */
    protected function pivotViewAction(string $relatedResourceClass): ViewAction
    {
        return ViewAction::make()
            ->url(function (Model $record) use ($relatedResourceClass): string {
                /** @var string $url */
                $url = $relatedResourceClass::getUrl('view', ['record' => $record]);

                return $url;
            });
    }

    /**
     * The row `edit` action: a modal touching only the pivot's own columns —
     * never the related record's own columns. See this trait's docblock for
     * why Filament's own EditAction already guarantees that split.
     *
     * @param  array<int, Component>  $pivotFields
     */
    protected function pivotEditAction(array $pivotFields): EditAction
    {
        return EditAction::make()
            ->modalHeading('Edit pivot details')
            ->form($pivotFields);
    }

    protected function pivotDetachAction(): DetachAction
    {
        return DetachAction::make();
    }

    protected function pivotDetachBulkAction(): DetachBulkAction
    {
        return DetachBulkAction::make();
    }
}
