<?php

namespace App\Filament\Resources;

use App\Enums\PublicationFormat;
use App\Filament\Resources\PublicationEditionResource\Pages\ViewPublicationEdition;
use App\Filament\Resources\RelationManagers\LinksRelationManager;
use App\Filament\Support\MarkdownState;
use App\Models\PublicationEdition;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

/**
 * A publication edition's own page (M16 F3), reached from the publication's
 * Editions manager. It exists to host the edition's Links (its shop links);
 * the edition itself is edited in that manager. An edition has no policy of
 * its own: it is governed by its publication's.
 */
class PublicationEditionResource extends Resource
{
    protected static ?string $model = PublicationEdition::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-book-open';

    protected static ?string $modelLabel = 'Publication edition';

    public static function getViewAnyAuthorizationResponse(): Response
    {
        return Gate::inspect('viewAny', static::getModel());
    }

    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }

    public static function getViewAuthorizationResponse(Model $record): Response
    {
        /** @var PublicationEdition $record */
        return $record->publication !== null
            ? Gate::inspect('view', $record->publication)
            : Response::deny();
    }

    public static function getCreateAuthorizationResponse(): Response
    {
        return Response::deny();
    }

    public static function getEditAuthorizationResponse(Model $record): Response
    {
        return Response::deny();
    }

    public static function getDeleteAuthorizationResponse(Model $record): Response
    {
        return Response::deny();
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->inlineLabel()
            ->components([
                Section::make('Edition')
                    ->schema([
                        TextEntry::make('publication.internal_name')
                            ->formatStateUsing(MarkdownState::inline())
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
                            ->formatStateUsing(MarkdownState::inline())
                            ->placeholder('—'),
                        TextEntry::make('publish_year')
                            ->label('Publish year')
                            ->placeholder('—'),
                        TextEntry::make('isbn')
                            ->label('ISBN')
                            ->placeholder('—'),
                        TextEntry::make('publisher')
                            ->formatStateUsing(MarkdownState::inline())
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
