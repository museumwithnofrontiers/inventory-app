<?php

namespace App\Filament\Resources\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\LanguageResource;
use App\Models\Context;
use App\Models\Language;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Resources\Resource;
use Filament\Tables\Actions\Action;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

abstract class BaseSiblingTranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'siblingTranslations';

    protected static ?string $title = 'Sibling Translations';

    /**
     * Returns the FQCN of the translation Filament resource (e.g. ItemTranslationResource::class).
     *
     * @return class-string<\Filament\Resources\Resource>
     */
    abstract protected static function translationResource(): string;

    /**
     * Returns the translation model attribute used as the primary title column (e.g. 'name' or 'title').
     */
    abstract protected static function translationTitleAttribute(): string;

    public function table(Table $table): Table
    {
        $resource = static::translationResource();
        $titleAttr = static::translationTitleAttribute();
        $titleLabel = ucfirst($titleAttr);

        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query
                ->with(['language:id,internal_name,is_default', 'context:id,internal_name,is_default'])
                ->where('id', '!=', $this->ownerRecord->getKey())
                ->orderBy('updated_at', 'desc')
            )
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->badge()
                    ->color(function (Model $r): string {
                        $lang = $r->getRelation('language');

                        return ($lang instanceof Language && $lang->is_default) ? 'success' : 'gray';
                    })
                    ->url(function (Model $r): ?string {
                        $lang = $r->getRelation('language');

                        return ($lang instanceof Language)
                            ? (auth()->user()?->can('view', $lang) ? LanguageResource::getUrl('view', ['record' => $lang]) : null)
                            : null;
                    }),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->badge()
                    ->color(function (Model $r): string {
                        $ctx = $r->getRelation('context');

                        return ($ctx instanceof Context && $ctx->is_default) ? 'success' : 'gray';
                    })
                    ->url(function (Model $r): ?string {
                        $ctx = $r->getRelation('context');

                        return ($ctx instanceof Context)
                            ? (auth()->user()?->can('view', $ctx) ? ContextResource::getUrl('view', ['record' => $ctx]) : null)
                            : null;
                    }),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(function (Model $r): bool {
                        $lang = $r->getRelation('language');
                        $ctx = $r->getRelation('context');

                        return $lang instanceof Language && $ctx instanceof Context && $lang->is_default && $ctx->is_default;
                    })
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make($titleAttr)
                    ->label($titleLabel)
                    ->limit(50),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->placeholder('—'),
                TextColumn::make('id')
                    ->label('UUID')
                    ->limit(8)
                    ->tooltip(fn (Model $r): string => is_scalar($r->getKey()) ? (string) $r->getKey() : '')
                    ->fontFamily('mono'),
            ])
            ->actions([
                Action::make('viewTranslation')
                    ->label('View')
                    ->icon('heroicon-o-eye')
                    ->url(fn (Model $r): string => (string) $resource::getUrl('view', ['record' => $r])),
                Action::make('editTranslation')
                    ->label('Edit')
                    ->icon('heroicon-o-pencil')
                    ->url(fn (Model $r): string => (string) $resource::getUrl('edit', ['record' => $r]))
                    ->visible(fn (Model $r): bool => $this->canEdit($r)),
            ]);
    }
}
