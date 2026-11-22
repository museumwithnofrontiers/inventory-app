<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\CollectionTranslationResource;
use App\Filament\Resources\ItemTranslationResource;
use App\Filament\Resources\PartnerTranslationResource;
use App\Filament\Support\MarkdownState;
use App\Models\CollectionTranslation;
use App\Models\ItemTranslation;
use App\Models\PartnerTranslation;
use Filament\Tables\Actions\Action;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;

class SiblingTranslationsWidget extends BaseWidget
{
    protected int|string|array $columnSpan = 'full';

    /** The parent entity FK value (item_id / collection_id / partner_id). */
    public string $parentId = '';

    /** Entity type — 'item', 'collection', or 'partner'. */
    public string $parentType = 'item';

    public static function canView(): bool
    {
        return auth()->user()?->can('viewAny', ItemTranslation::class) ?? false;
    }

    public function table(Table $table): Table
    {
        if ($this->parentId === '') {
            throw new \InvalidArgumentException('SiblingTranslationsWidget requires a non-empty parentId.');
        }

        return match ($this->parentType) {
            'item' => $this->itemTable($table),
            'collection' => $this->collectionTable($table),
            'partner' => $this->partnerTable($table),
            default => throw new \InvalidArgumentException("Unsupported parentType: \"{$this->parentType}\"."),
        };
    }

    private function itemTable(Table $table): Table
    {
        $parentId = $this->parentId;

        return $table
            ->query(fn (): Builder => ItemTranslation::query()
                ->with(['language:id,internal_name,is_default', 'context:id,internal_name,is_default'])
                ->where('item_id', $parentId)
                ->orderBy('updated_at', 'desc')
            )
            ->paginated(false)
            ->heading('Sibling Item Translations')
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->badge()
                    ->color(fn (ItemTranslation $r): string => $r->language?->is_default ? 'success' : 'gray'),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->badge()
                    ->color(fn (ItemTranslation $r): string => $r->context?->is_default ? 'success' : 'gray'),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (ItemTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('name')
                    ->label('Name')
                    ->formatStateUsing(MarkdownState::excerpt(50)),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->placeholder('—'),
                TextColumn::make('id')
                    ->label('UUID')
                    ->limit(8)
                    ->tooltip(fn (ItemTranslation $r): string => $r->id)
                    ->fontFamily('mono'),
            ])
            ->actions([
                Action::make('viewTranslation')
                    ->label('View')
                    ->icon('heroicon-o-eye')
                    ->url(fn (ItemTranslation $r): string => ItemTranslationResource::getUrl('view', ['record' => $r])),
                Action::make('editTranslation')
                    ->label('Edit')
                    ->icon('heroicon-o-pencil')
                    ->url(fn (ItemTranslation $r): string => ItemTranslationResource::getUrl('edit', ['record' => $r]))
                    ->visible(fn (ItemTranslation $r): bool => auth()->user()?->can('update', $r) ?? false),
            ]);
    }

    private function collectionTable(Table $table): Table
    {
        $parentId = $this->parentId;

        return $table
            ->query(fn (): Builder => CollectionTranslation::query()
                ->with(['language:id,internal_name,is_default', 'context:id,internal_name,is_default'])
                ->where('collection_id', $parentId)
                ->orderBy('updated_at', 'desc')
            )
            ->paginated(false)
            ->heading('Sibling Collection Translations')
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->badge()
                    ->color(fn (CollectionTranslation $r): string => $r->language?->is_default ? 'success' : 'gray'),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->badge()
                    ->color(fn (CollectionTranslation $r): string => $r->context?->is_default ? 'success' : 'gray'),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (CollectionTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('title')
                    ->label('Title')
                    ->formatStateUsing(MarkdownState::excerpt(50)),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->placeholder('—'),
                TextColumn::make('id')
                    ->label('UUID')
                    ->limit(8)
                    ->tooltip(fn (CollectionTranslation $r): string => $r->id)
                    ->fontFamily('mono'),
            ])
            ->actions([
                Action::make('viewTranslation')
                    ->label('View')
                    ->icon('heroicon-o-eye')
                    ->url(fn (CollectionTranslation $r): string => CollectionTranslationResource::getUrl('view', ['record' => $r])),
                Action::make('editTranslation')
                    ->label('Edit')
                    ->icon('heroicon-o-pencil')
                    ->url(fn (CollectionTranslation $r): string => CollectionTranslationResource::getUrl('edit', ['record' => $r]))
                    ->visible(fn (CollectionTranslation $r): bool => auth()->user()?->can('update', $r) ?? false),
            ]);
    }

    private function partnerTable(Table $table): Table
    {
        $parentId = $this->parentId;

        return $table
            ->query(fn (): Builder => PartnerTranslation::query()
                ->with(['language:id,internal_name,is_default', 'context:id,internal_name,is_default'])
                ->where('partner_id', $parentId)
                ->orderBy('updated_at', 'desc')
            )
            ->paginated(false)
            ->heading('Sibling Partner Translations')
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->badge()
                    ->color(fn (PartnerTranslation $r): string => $r->language?->is_default ? 'success' : 'gray'),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->badge()
                    ->color(fn (PartnerTranslation $r): string => $r->context?->is_default ? 'success' : 'gray'),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (PartnerTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('name')
                    ->label('Name')
                    ->formatStateUsing(MarkdownState::excerpt(50)),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->placeholder('—'),
                TextColumn::make('id')
                    ->label('UUID')
                    ->limit(8)
                    ->tooltip(fn (PartnerTranslation $r): string => $r->id)
                    ->fontFamily('mono'),
            ])
            ->actions([
                Action::make('viewTranslation')
                    ->label('View')
                    ->icon('heroicon-o-eye')
                    ->url(fn (PartnerTranslation $r): string => PartnerTranslationResource::getUrl('view', ['record' => $r])),
                Action::make('editTranslation')
                    ->label('Edit')
                    ->icon('heroicon-o-pencil')
                    ->url(fn (PartnerTranslation $r): string => PartnerTranslationResource::getUrl('edit', ['record' => $r]))
                    ->visible(fn (PartnerTranslation $r): bool => auth()->user()?->can('update', $r) ?? false),
            ]);
    }
}
