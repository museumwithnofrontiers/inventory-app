<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use Filament\Schemas\Schema;
use Filament\Actions\CreateAction;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use App\Enums\ItemType;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\ItemItemLinkResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Models\ItemItemLink;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class OutgoingLinksRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'outgoingLinks';

    protected static ?string $recordTitleAttribute = 'id';

    protected static ?string $title = 'Outgoing links';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TranslationFormSchema::itemSelectField(name: 'target_id', label: 'Target item'),
                TranslationFormSchema::contextSelectField(required: false),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'target:id,internal_name,type',
                'context:id,internal_name',
            ]))
            ->defaultSort('created_at', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('target.internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Target item')
                    ->sortable()
                    ->url(fn (ItemItemLink $record): ?string => $record->target
                        ? (auth()->user()?->can('view', $record->target) ? ItemResource::getUrl('view', ['record' => $record->target]) : null)
                        : null),
                TextColumn::make('target.type')
                    ->label('Target type')
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
            ->recordActions([
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
