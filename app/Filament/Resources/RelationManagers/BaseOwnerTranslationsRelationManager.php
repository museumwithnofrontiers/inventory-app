<?php

namespace App\Filament\Resources\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\ResourceCreateUrl;
use App\Models\Context;
use App\Models\Language;
use Filament\Forms\Components\Component;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Resources\Resource;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Shared shape for the owner-side TranslationsRelationManager of Collection,
 * Item and Partner (M7 story A3.1, epic #1874).
 *
 * Mirrors {@see BaseSiblingTranslationsRelationManager}'s abstract-hook shape,
 * but for the other side of the relationship: the manager that lists every
 * translation of the record being edited (rather than a translation's own
 * siblings). Locked convention: a translation has its own Resource
 * (`Collection|Item|Partner`TranslationResource), so the header `Create`
 * navigates there — parent pre-filled via {@see ResourceCreateUrl} /
 * `PrefillsCreateFormFromQuery` — instead of opening an inline form. The
 * form itself therefore lives once, on that Resource; this class (and every
 * concrete manager extending it) carries no create/edit form of its own.
 *
 * `createDefaultTranslation` stays a one-click, no-form action gated on the
 * same default-language/default-context pair. Its own small form differs
 * enough per parent (Collection needs `url`, Item needs `alternate_name`,
 * Partner needs neither) that each concrete subclass supplies it via
 * {@see self::defaultTranslationFormFields()}.
 *
 * Column closures accept the base `Model` type and read via
 * `getAttribute()` rather than the concrete translation model's magic
 * properties: `getAttribute()` is the same lazy-loading path property access
 * uses, but — unlike a typed property — it is a plain method call, so it
 * carries no static-analysis expectation that `Model` declares a `language`
 * or `context` relation.
 */
abstract class BaseOwnerTranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'translations';

    protected static ?string $title = 'Translations';

    /**
     * @return class-string<\Filament\Resources\Resource>
     */
    abstract protected static function translationResource(): string;

    /**
     * The translation model's primary title column: 'title' for Collection,
     * 'name' for Item and Partner.
     */
    abstract protected static function titleAttribute(): string;

    /**
     * The {@see ResourceCreateUrl::QUERY_KEYS} key the Create page pre-fills
     * from: 'collection_id', 'item_id' or 'partner_id'.
     */
    abstract protected static function ownerQueryKey(): string;

    /**
     * The row action that links back to the owner record, e.g.
     * `Action::make('viewParentCollection')`.
     */
    abstract protected static function viewParentAction(): Action;

    /**
     * The one-click createDefaultTranslation action's form fields.
     *
     * @return array<int, Component>
     */
    abstract protected static function defaultTranslationFormFields(): array;

    /**
     * The owner record's `translations()` relation. Typed and implemented by
     * the concrete subclass so this base class never has to call a relation
     * method on the bare `Model` the RelationManager stores $ownerRecord as.
     */
    abstract protected function translationsRelation(): HasMany;

    public function table(Table $table): Table
    {
        $titleAttr = static::titleAttribute();
        $translationResource = static::translationResource();

        return $table
            ->recordTitleAttribute($titleAttr)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'context:id,internal_name,is_default',
                'language:id,internal_name,is_default',
            ]))
            ->defaultSort($titleAttr, 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge()
                    ->color(function (Model $r): string {
                        $language = $r->getAttribute('language');

                        return ($language instanceof Language && $language->is_default) ? 'success' : 'gray';
                    })
                    ->url(function (Model $r): ?string {
                        $language = $r->getAttribute('language');

                        return ($language instanceof Language)
                            ? (auth()->user()?->can('view', $language) ? LanguageResource::getUrl('view', ['record' => $language]) : null)
                            : null;
                    }),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->badge()
                    ->color(function (Model $r): string {
                        $context = $r->getAttribute('context');

                        return ($context instanceof Context && $context->is_default) ? 'success' : 'gray';
                    })
                    ->url(function (Model $r): ?string {
                        $context = $r->getAttribute('context');

                        return ($context instanceof Context)
                            ? (auth()->user()?->can('view', $context) ? ContextResource::getUrl('view', ['record' => $context]) : null)
                            : null;
                    }),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(function (Model $r): bool {
                        $language = $r->getAttribute('language');
                        $context = $r->getAttribute('context');

                        return $language instanceof Language && $context instanceof Context
                            && $language->is_default && $context->is_default;
                    })
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make($titleAttr)
                    ->searchable()
                    ->sortable(),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable(),
                SelectFilter::make('context_id')
                    ->label('Context')
                    ->relationship('context', 'internal_name')
                    ->searchable(),
            ])
            ->headerActions([
                Action::make('create')
                    ->icon('heroicon-o-plus')
                    ->url(fn (): string => ResourceCreateUrl::for(
                        $translationResource,
                        [static::ownerQueryKey() => (string) $this->getOwnerRecord()->getKey()]
                    ))
                    ->visible(fn (): bool => $this->canCreate()),
                Action::make('createDefaultTranslation')
                    ->label('Create default translation')
                    ->icon('heroicon-o-star')
                    ->color('warning')
                    ->form(static::defaultTranslationFormFields())
                    ->fillForm(fn (): array => [
                        'language_id' => Language::default()->first()?->id,
                        'context_id' => Context::default()->first()?->id,
                    ])
                    ->visible(fn (): bool => $this->canCreate()
                        && ! $this->translationsRelation()
                            ->whereHas('language', fn (Builder $q): Builder => $q->where('is_default', true))
                            ->whereHas('context', fn (Builder $q): Builder => $q->where('is_default', true))
                            ->exists()
                    )
                    ->action(function (array $data): void {
                        /** @var array<string, mixed> $data */
                        $exists = $this->translationsRelation()
                            ->where('language_id', $data['language_id'])
                            ->where('context_id', $data['context_id'])
                            ->exists();

                        if ($exists) {
                            Notification::make()
                                ->warning()
                                ->title('Translation already exists for this language and context.')
                                ->send();

                            return;
                        }

                        $this->translationsRelation()->create($data);

                        Notification::make()
                            ->success()
                            ->title('Default translation created.')
                            ->send();
                    }),
            ])
            ->actions([
                Action::make('viewTranslation')
                    ->label('View translation')
                    ->icon('heroicon-o-eye')
                    ->url(fn (Model $r): string => $translationResource::getUrl('view', ['record' => $r])),
                Action::make('editTranslation')
                    ->label('Edit translation')
                    ->icon('heroicon-o-pencil')
                    ->url(fn (Model $r): string => $translationResource::getUrl('edit', ['record' => $r]))
                    ->visible(fn (Model $r): bool => $this->canEdit($r)),
                static::viewParentAction(),
                DeleteAction::make(),
            ]);
    }
}
