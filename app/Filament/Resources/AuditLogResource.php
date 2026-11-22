<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AuditLogResource\Pages\ListAuditLog;
use App\Filament\Resources\AuditLogResource\Pages\ViewAuditLog;
use App\Models\AuditLog;
use App\Policies\AuditLogPolicy;
use Filament\Infolists\Components\KeyValueEntry;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

/**
 * The audit log, read-only: user managers read it, nobody edits or deletes
 * an entry ({@see AuditLogPolicy}).
 */
class AuditLogResource extends Resource
{
    protected static ?string $model = AuditLog::class;

    protected static ?string $navigationIcon = 'heroicon-o-clipboard-document-list';

    protected static ?string $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 5;

    protected static ?string $navigationLabel = 'Audit Log';

    protected static ?string $modelLabel = 'audit log entry';

    protected static ?string $pluralModelLabel = 'audit log';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('viewAny', static::getModel()) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('occurred_at', 'desc')
            ->recordUrl(fn (AuditLog $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->columns([
                TextColumn::make('occurred_at')
                    ->label('When')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('actor_label')
                    ->label('Who')
                    ->searchable(),
                TextColumn::make('channel')
                    ->badge(),
                TextColumn::make('action')
                    ->badge()
                    ->searchable(),
                TextColumn::make('subject_label')
                    ->label('Subject')
                    ->searchable(),
            ])
            ->filters([
                SelectFilter::make('action')
                    ->options(fn (): array => AuditLog::query()->distinct()->orderBy('action')->pluck('action', 'action')->all()),
                SelectFilter::make('channel')
                    ->options(['panel' => 'panel', 'api' => 'api', 'mcp' => 'mcp', 'console' => 'console', 'system' => 'system']),
            ])
            ->actions([
                ViewAction::make(),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Entry')
                    ->schema([
                        TextEntry::make('occurred_at')->label('When')->dateTime(),
                        TextEntry::make('actor_label')->label('Who'),
                        TextEntry::make('channel'),
                        TextEntry::make('ip_address')->label('IP address')->placeholder('—'),
                        TextEntry::make('action'),
                        TextEntry::make('subject_label')->label('Subject')->placeholder('—'),
                        TextEntry::make('subject_type')->label('Subject type')->placeholder('—'),
                        TextEntry::make('subject_id')->label('Subject id')->placeholder('—'),
                    ])
                    ->columns(2),
                InfolistSection::make('Changes')
                    ->schema([
                        KeyValueEntry::make('changes')
                            ->hiddenLabel()
                            ->getStateUsing(fn (AuditLog $record): array => collect($record->changes ?? [])
                                ->map(fn (mixed $value): string => is_string($value)
                                    ? $value
                                    : (string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE))
                                ->all()),
                    ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListAuditLog::route('/'),
            'view' => ViewAuditLog::route('/{record}'),
        ];
    }
}
