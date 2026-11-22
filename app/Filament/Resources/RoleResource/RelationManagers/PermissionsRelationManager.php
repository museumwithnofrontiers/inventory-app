<?php

namespace App\Filament\Resources\RoleResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * A role's permissions, read-only: they are defined in code
 * (App\Enums\Role::permissions()) and kept in the database by RoleSync.
 */
class PermissionsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'permissions';

    protected static ?string $title = 'Permissions';

    protected static ?string $recordTitleAttribute = 'name';

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('name')
            ->defaultSort('name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('description')
                    ->wrap(),
            ]);
    }
}
