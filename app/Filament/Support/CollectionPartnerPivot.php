<?php

namespace App\Filament\Support;

use App\Enums\PartnerLevel;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Toggle;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;

/**
 * Shared Filament helpers for the collection_partner pivot (`level`,
 * `visible`) — M7 story A2.2 (#1901). Used identically by both sides of the
 * pivot: CollectionResource\PartnersRelationManager and
 * PartnerResource\CollectionParticipationsRelationManager.
 */
class CollectionPartnerPivot
{
    /**
     * The pivot's own editable fields — level and visible — shared by both
     * managers' Attach and Edit-pivot forms.
     *
     * @return array<int, Component>
     */
    public static function pivotFormFields(): array
    {
        return [
            Select::make('level')
                ->label('Level')
                ->options(PartnerLevel::options())
                ->required(),
            Toggle::make('visible')
                ->label('Visible')
                ->default(true),
        ];
    }

    /**
     * The Attach form: {@see self::pivotFormFields()} plus the fixed
     * `collection_type` discriminator (always 'collection' — this pivot table
     * also carries non-collection rows, per Collection::partners()'s own
     * `wherePivot('collection_type', '=', 'collection')`). Never part of the
     * Edit-pivot form: it's set once, at attach time, not user-editable.
     *
     * @return array<int, Component>
     */
    public static function attachFormFields(): array
    {
        return [
            ...self::pivotFormFields(),
            Hidden::make('collection_type')->default('collection'),
        ];
    }

    public static function levelColumn(): TextColumn
    {
        return TextColumn::make('pivot.level')
            ->label('Level')
            ->formatStateUsing(fn (?string $state): ?string => $state ? PartnerLevel::from($state)->label() : null)
            ->sortable();
    }

    public static function visibleColumn(): IconColumn
    {
        return IconColumn::make('pivot.visible')
            ->label('Visible')
            ->boolean();
    }
}
