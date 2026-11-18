<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ContributorResource;
use App\Filament\Support\ResourceCreateUrl;
use App\Models\Contributor;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * The collection's contributors and credits (M16 I5, #2648). The has-many
 * convention for a required parent, as Timeline → Events (#2090):
 * `contributors.collection_id` is NOT NULL, so a contributor always belongs
 * to one collection, and there is no `Attach existing` and no `Detach`.
 *
 * Header: `Create` (navigates to ContributorResource's Create page,
 * `collection_id` pre-filled via {@see ResourceCreateUrl}). Row: `View` ·
 * `Edit` (ContributorResource's pages) · `Delete`. No bulk action.
 */
class ContributorsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'contributors';

    protected static ?string $recordTitleAttribute = 'internal_name';

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->withCount('translations'))
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('category')
                    ->formatStateUsing(fn (string $state): string => ContributorResource::CREDIT_CATEGORIES[$state] ?? $state)
                    ->badge()
                    ->sortable(),
                TextColumn::make('internal_name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('translations_count')
                    ->label('Translations'),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable(),
                IconColumn::make('visible')
                    ->boolean(),
            ])
            ->headerActions([
                Action::make('create')
                    ->label('Create')
                    ->icon('heroicon-o-plus')
                    ->url(fn (): string => ResourceCreateUrl::for(ContributorResource::class, [
                        'collection_id' => $this->getOwnerRecord()->getKey(),
                    ]))
                    ->visible(fn (): bool => $this->canCreate()),
            ])
            ->actions([
                ViewAction::make()
                    ->url(fn (Contributor $record): ?string => auth()->user()?->can('view', $record)
                        ? ContributorResource::getUrl('view', ['record' => $record])
                        : null),
                EditAction::make()
                    ->url(fn (Contributor $record): string => ContributorResource::getUrl('edit', ['record' => $record])),
                DeleteAction::make(),
            ])
            ->bulkActions([]);
    }
}
