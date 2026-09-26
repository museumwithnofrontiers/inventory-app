<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Pages\ViewCollectionItemAppearance;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\CollectionItemAppearance;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use App\Models\Item;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class CollectionAppearancesRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'attachedToCollections';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Collection appearances';

    public function table(Table $table): Table
    {
        return $table
            ->inverseRelationship('attachedItems')
            ->modifyQueryUsing(fn (Builder $query): Builder => CollectionDisplayLabel::withDisplayLabel(
                $query->with([
                    'context:id,internal_name',
                    'language:id,internal_name',
                    'parent:id,internal_name',
                ])
            ))
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                CollectionDisplayLabel::displayLabelColumn()
                    ->url(fn (Collection $record): ?string => $this->getAuthorizedUrl($record, CollectionResource::class)),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(),
                TextColumn::make('parent.internal_name')
                    ->label('Parent collection')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Collection $record): ?string => $record->parent
                        ? $this->getAuthorizedUrl($record->parent, CollectionResource::class)
                        : null),
                CollectionItemAppearance::displayOrderColumn(),
                CollectionItemAppearance::contextualTextPreviewColumn(),
                CollectionItemAppearance::contextualTextLanguagesColumn(),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Collection $record): ?string => $record->context
                        ? $this->getAuthorizedUrl($record->context, ContextResource::class)
                        : null),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->toggleable()
                    ->url(fn (Collection $record): ?string => $record->language
                        ? $this->getAuthorizedUrl($record->language, LanguageResource::class)
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
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::COLLECTIONS, CollectionItemAppearance::pivotFormFields()),
            ])
            ->actions([
                $this->pivotViewAction(CollectionResource::class),
                $this->pivotEditAction(CollectionItemAppearance::pivotFormFields()),
                $this->pivotDetachAction(),
                Action::make('view_appearance')
                    ->label('View appearance')
                    ->icon('heroicon-o-document-text')
                    ->color('gray')
                    ->url(function (Collection $record): string {
                        /** @var Item $item */
                        $item = $this->getOwnerRecord();

                        return ViewCollectionItemAppearance::getAppearanceUrl($record, $item);
                    }),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }

    /**
     * @param  class-string<\Filament\Resources\Resource>  $resourceClass
     */
    private function getAuthorizedUrl(mixed $record, string $resourceClass): ?string
    {
        if (! auth()->user()?->can('view', $record)) {
            return null;
        }
        /** @var string $url */
        $url = $resourceClass::getUrl('view', ['record' => $record]);

        return $url;
    }
}
