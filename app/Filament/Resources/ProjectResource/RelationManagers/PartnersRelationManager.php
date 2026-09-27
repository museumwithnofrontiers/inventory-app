<?php

namespace App\Filament\Resources\ProjectResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\HasManyChildActions;
use App\Filament\Resources\CountryResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Support\PartnerDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Partner;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * M7 story A5.3 (epic #1876): the has-many convention on a project's
 * partners. Header `Create` (Partner's own Create page, `project_id`
 * pre-filled) and `Attach existing` (AssociateAction). Row `View` · `Edit` ·
 * `Detach` (sets `project_id` to null) · `Delete`. Bulk `Detach`. See
 * {@see HasManyChildActions} for the shared wiring.
 */
class PartnersRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    /** @use HasManyChildActions<Partner> */
    use HasManyChildActions;

    protected static string $relationship = 'partners';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Partners';

    protected static function hasManyChildResource(): string
    {
        return PartnerResource::class;
    }

    protected static function hasManyChildForeignKey(): string
    {
        return 'project_id';
    }

    protected static function hasManyChildRecordSelectEntity(): string
    {
        return RecordSelect::PARTNERS;
    }

    public function table(Table $table): Table
    {
        return $this->hasManyChildConfigureTable(
            $table
                ->modifyQueryUsing(fn (Builder $query): Builder => PartnerDisplayLabel::withDisplayLabel(
                    $query->with([
                        'country:id,internal_name',
                    ])
                ))
                ->defaultSort('internal_name', 'asc')
                ->paginated([25, 50, 100])
                ->defaultPaginationPageOption(25)
                ->columns([
                    PartnerDisplayLabel::displayLabelColumn()
                        ->url(fn (Partner $record): ?string => auth()->user()?->can('view', $record)
                            ? PartnerResource::getUrl('view', ['record' => $record])
                            : null),
                    TextColumn::make('type')
                        ->sortable(),
                    TextColumn::make('country.internal_name')
                        ->label('Country')
                        ->sortable()
                        ->url(fn (Partner $record): ?string => $record->country
                            ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                            : null),
                    TextColumn::make('internal_name')
                        ->searchable()
                        ->sortable()
                        ->toggleable(isToggledHiddenByDefault: true),
                    TextColumn::make('created_at')
                        ->label('Created')
                        ->dateTime()
                        ->sortable()
                        ->toggleable(isToggledHiddenByDefault: true),
                ])
        );
    }
}
