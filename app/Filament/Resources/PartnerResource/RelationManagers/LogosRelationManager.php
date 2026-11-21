<?php

namespace App\Filament\Resources\PartnerResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Support\MarkdownState;
use App\Models\PartnerLogo;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * A partner's logos (PartnerLogo, in the attached image registry). The panel
 * shows the original, as for the partner's images. Logos have no upload here:
 * they come only through the import, so there is no attach.
 */
class LogosRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'partnerLogos';

    protected static ?string $recordTitleAttribute = 'path';

    protected static ?string $title = 'Logos';

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                ImageColumn::make('preview')
                    ->label('Preview')
                    ->getStateUsing(fn (PartnerLogo $record): string => $this->viewUrl($record))
                    ->height(48)
                    ->url(fn (PartnerLogo $record): string => $this->viewUrl($record))
                    ->openUrlInNewTab()
                    ->defaultImageUrl(null),
                TextColumn::make('path')
                    ->label('Filename')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('logo_type')
                    ->label('Type')
                    ->badge(),
                TextColumn::make('alt_text')
                    ->label('Alt text')
                    ->formatStateUsing(MarkdownState::excerpt(50))
                    ->toggleable(),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable(),
                TextColumn::make('mime_type')
                    ->label('MIME type')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->actions([
                Action::make('view_image')
                    ->label('View image')
                    ->icon('heroicon-o-eye')
                    ->color('gray')
                    ->url(fn (PartnerLogo $record): string => $this->viewUrl($record))
                    ->openUrlInNewTab(),
                Action::make('download')
                    ->label('Download')
                    ->icon('heroicon-o-arrow-down-tray')
                    ->color('gray')
                    ->url(fn (PartnerLogo $record): string => route('filament.admin.partner-logo.download', $this->routeParameters($record))),
                EditAction::make()
                    ->form([
                        TextInput::make('logo_type')
                            ->label('Type')
                            ->required()
                            ->maxLength(50),
                        TextInput::make('alt_text')
                            ->label('Alt text')
                            ->maxLength(255)
                            ->nullable(),
                        TextInput::make('display_order')
                            ->label('Display order')
                            ->numeric()
                            ->integer()
                            ->required(),
                        TextInput::make('copyright')
                            ->label('Copyright')
                            ->maxLength(500)
                            ->nullable()
                            ->dehydrateStateUsing(fn (?string $state): ?string => filled($state) ? $state : null),
                    ]),
                DeleteAction::make()
                    ->label('Delete permanently')
                    ->requiresConfirmation()
                    ->modalHeading('Delete logo permanently')
                    ->modalDescription('The logo file will be permanently deleted from storage and cannot be recovered.'),
            ]);
    }

    private function viewUrl(PartnerLogo $record): string
    {
        return route('filament.admin.partner-logo.view', $this->routeParameters($record));
    }

    /**
     * @return array{partner: string, partnerLogo: string}
     */
    private function routeParameters(PartnerLogo $record): array
    {
        return ['partner' => $record->partner_id, 'partnerLogo' => $record->id];
    }
}
