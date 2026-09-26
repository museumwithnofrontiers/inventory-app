<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\HasManyChildActions;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * M7 story A1.1 (epic #1872): the has-many convention's pattern-setter.
 * Header `Create` (Collection's own Create page, `parent_id` pre-filled) and
 * `Attach existing` (AssociateAction, cycle-guarded via
 * {@see RecordSelect::excludingAncestorsOf()} so an ancestor of this
 * collection can never become one of its children). Row `View` · `Edit` ·
 * `Detach` (clears `parent_id`) · `Delete`. Bulk `Detach`. See
 * {@see HasManyChildActions} for the shared wiring
 * A1.2-A1.4 reuse.
 */
class ChildCollectionsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    /** @use HasManyChildActions<Collection> */
    use HasManyChildActions;

    protected static string $relationship = 'children';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Child collections';

    protected static function hasManyChildResource(): string
    {
        return CollectionResource::class;
    }

    protected static function hasManyChildForeignKey(): string
    {
        return 'parent_id';
    }

    protected static function hasManyChildRecordSelectEntity(): string
    {
        return RecordSelect::COLLECTIONS;
    }

    /**
     * @param  Builder<Collection>  $query
     * @return Builder<Collection>
     */
    protected function hasManyChildAssociateScope(Builder $query): Builder
    {
        /** @var Collection $owner */
        $owner = $this->getOwnerRecord();

        return RecordSelect::excludingAncestorsOf($query, $owner);
    }

    public function table(Table $table): Table
    {
        return $this->hasManyChildConfigureTable(
            $table
                ->modifyQueryUsing(fn (Builder $query): Builder => CollectionDisplayLabel::withDisplayLabel(
                    $query->with([
                        'context:id,internal_name',
                        'language:id,internal_name',
                    ])
                ))
                ->defaultSort('internal_name', 'asc')
                ->paginated([25, 50, 100])
                ->defaultPaginationPageOption(25)
                ->columns([
                    CollectionDisplayLabel::displayLabelColumn()
                        ->url(fn (Collection $record): ?string => auth()->user()?->can('view', $record)
                            ? CollectionResource::getUrl('view', ['record' => $record])
                            : null),
                    TextColumn::make('type')
                        ->badge()
                        ->sortable(),
                    TextColumn::make('context.internal_name')
                        ->label('Context')
                        ->sortable()
                        ->url(fn (Collection $record): ?string => $record->context
                            ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                            : null),
                    TextColumn::make('language.internal_name')
                        ->label('Language')
                        ->sortable()
                        ->url(fn (Collection $record): ?string => $record->language
                            ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                            : null),
                    TextColumn::make('internal_name')
                        ->label('Internal name')
                        ->searchable()
                        ->sortable()
                        ->toggleable(isToggledHiddenByDefault: true),
                    TextColumn::make('created_at')
                        ->label('Created')
                        ->dateTime()
                        ->sortable()
                        ->toggleable(isToggledHiddenByDefault: true),
                ])
        );
    }
}
