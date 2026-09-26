<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Enums\ItemType;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\ItemItemLinkResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Support\TranslationFormSchema;
use App\Models\ItemItemLink;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class IncomingLinksRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'incomingLinks';

    protected static ?string $recordTitleAttribute = 'id';

    protected static ?string $title = 'Incoming links';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                TranslationFormSchema::itemSelectField(name: 'source_id', label: 'Source item'),
                TranslationFormSchema::contextSelectField(required: false),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'source:id,internal_name,type',
                'context:id,internal_name',
            ]))
            ->defaultSort('created_at', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('source.internal_name')
                    ->label('Source item')
                    ->sortable()
                    ->url(fn (ItemItemLink $record): ?string => $record->source
                        ? (auth()->user()?->can('view', $record->source) ? ItemResource::getUrl('view', ['record' => $record->source]) : null)
                        : null),
                TextColumn::make('source.type')
                    ->label('Source type')
                    ->badge()
                    ->formatStateUsing(fn (mixed $state): string => $state instanceof ItemType ? $state->label() : (is_scalar($state) ? (string) $state : '')),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->url(fn (ItemItemLink $record): ?string => $record->context
                        ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                        : null),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                CreateAction::make(),
            ])
            ->actions([
                Action::make('viewLink')
                    ->label('View link')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (ItemItemLink $record): ?string => auth()->user()?->can('view', $record)
                        ? ItemItemLinkResource::getUrl('view', ['record' => $record])
                        : null)
                    ->openUrlInNewTab(),
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }
}
