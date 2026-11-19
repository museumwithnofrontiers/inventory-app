<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Enums\PublicationFormat;
use App\Filament\Resources\PublicationEditionResource\Pages\ViewPublicationEdition;
use App\Filament\Resources\RelationManagers\LinksRelationManager;
use App\Models\PublicationEdition;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Illuminate\Database\Eloquent\Model;

/**
 * A publication edition's own page (M16 F3), reached from the publication's
 * Editions manager. It exists to host the edition's Links (its shop links);
 * the edition itself is edited in that manager. An edition has no policy of
 * its own: it is governed by its publication's.
 */
class PublicationEditionResource extends Resource
{
    protected static ?string $model = PublicationEdition::class;

    protected static ?string $navigationIcon = 'heroicon-o-book-open';

    protected static ?string $modelLabel = 'Publication edition';

    public static function canViewAny(): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::VIEW_DATA->value) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }

    public static function canView(Model $record): bool
    {
        /** @var PublicationEdition $record */
        return $record->publication !== null && (auth()->user()?->can('view', $record->publication) ?? false);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Edition')
                    ->schema([
                        TextEntry::make('publication.internal_name')
                            ->label('Publication')
                            ->url(fn (PublicationEdition $record): ?string => $record->publication
                                && (auth()->user()?->can('view', $record->publication) ?? false)
                                ? PublicationResource::getUrl('view', ['record' => $record->publication])
                                : null),
                        TextEntry::make('language.internal_name')
                            ->label('Language'),
                        TextEntry::make('format')
                            ->formatStateUsing(fn (?PublicationFormat $state): ?string => $state?->label()),
                        TextEntry::make('edition')
                            ->placeholder('—'),
                        TextEntry::make('publish_year')
                            ->label('Publish year')
                            ->placeholder('—'),
                        TextEntry::make('isbn')
                            ->label('ISBN')
                            ->placeholder('—'),
                        TextEntry::make('publisher')
                            ->placeholder('—'),
                    ])
                    ->columns(2),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            LinksRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'view' => ViewPublicationEdition::route('/{record}'),
        ];
    }
}
