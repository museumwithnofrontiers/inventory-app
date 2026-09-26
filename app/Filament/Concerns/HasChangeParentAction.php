<?php

namespace App\Filament\Concerns;

use App\Filament\Support\RecordSelect;
use Filament\Forms\Components\Select;
use Filament\Notifications\Notification;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\BulkAction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * @template TModel of Model
 */
trait HasChangeParentAction
{
    /**
     * @return class-string<TModel>
     */
    abstract protected static function changeParentModelClass(): string;

    abstract protected static function changeParentSelectLabel(): string;

    abstract protected static function changeParentPluralLabel(): string;

    /**
     * Override to restrict the search query for the row action (e.g., excluding descendants).
     *
     * Defaults to RecordSelect::excludingDescendantsOf(), which is a no-op for
     * a model that doesn't define an `excludingDescendantsOf` local scope.
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    protected static function changeParentRowQueryScope(Builder $query, Model $record): Builder
    {
        return RecordSelect::excludingDescendantsOf($query, $record);
    }

    /**
     * Override to customise how the search results are formatted in the parent-selector
     * dropdown. The default implementation returns internal_name keyed by ID. Resources
     * that support translated display labels should override this to return translated labels.
     *
     * @param  Builder<TModel>  $query
     * @return array<string, string>
     */
    protected static function changeParentSearchResults(Builder $query): array
    {
        return $query->pluck('internal_name', 'id')->all();
    }

    /**
     * Override to customise how a selected option value is resolved back to a human-readable
     * label in the parent-selector dropdown. The default uses internal_name.
     */
    protected static function changeParentOptionLabel(mixed $value): string
    {
        $modelClass = static::changeParentModelClass();

        return $modelClass::find($value)?->internal_name ?? (is_scalar($value) ? (string) $value : '');
    }

    protected static function changeParentAction(): Action
    {
        $modelClass = static::changeParentModelClass();
        $resourceName = class_basename(static::class);
        $idKey = Str::snake(class_basename($modelClass)).'_id';

        return Action::make('changeParent')
            ->label('Change parent')
            ->icon('heroicon-o-arrow-uturn-up')
            ->form(fn (Model $record): array => [
                Select::make('parent_id')
                    ->label(static::changeParentSelectLabel())
                    ->nullable()
                    ->getSearchResultsUsing(fn (string $search): array => static::changeParentSearchResults(
                        RecordSelect::applyBoundedSearch(
                            static::changeParentRowQueryScope($modelClass::query(), $record),
                            $search
                        )
                    ))
                    ->getOptionLabelUsing(fn ($value): string => static::changeParentOptionLabel($value))
                    ->searchable(),
            ])
            ->action(function (Model $record, array $data) use ($resourceName, $idKey): void {
                try {
                    $record->setAttribute('parent_id', $data['parent_id'] ?? null);
                    $record->save();

                    Notification::make()
                        ->success()
                        ->title('Parent updated')
                        ->send();
                } catch (\RuntimeException $e) {
                    logger()->warning($resourceName.': changeParent failed', [
                        $idKey => $record->getKey(),
                        'new_parent_id' => $data['parent_id'] ?? null,
                        'error' => $e->getMessage(),
                    ]);

                    Notification::make()
                        ->danger()
                        ->title('Cannot change parent')
                        ->body('The selected parent would create a circular hierarchy. Please choose a different parent.')
                        ->send();
                }
            });
    }

    protected static function moveToParentAction(): BulkAction
    {
        $modelClass = static::changeParentModelClass();
        $resourceName = class_basename(static::class);
        $idKey = Str::snake(class_basename($modelClass)).'_id';
        $pluralLabel = static::changeParentPluralLabel();

        return BulkAction::make('moveToParent')
            ->label('Move to parent')
            ->icon('heroicon-o-arrow-uturn-up')
            ->form([
                Select::make('parent_id')
                    ->label(static::changeParentSelectLabel())
                    ->nullable()
                    ->getSearchResultsUsing(fn (string $search): array => static::changeParentSearchResults(
                        RecordSelect::applyBoundedSearch($modelClass::query(), $search)
                    ))
                    ->getOptionLabelUsing(fn ($value): string => static::changeParentOptionLabel($value))
                    ->searchable(),
            ])
            ->action(function (EloquentCollection $records, array $data) use ($resourceName, $idKey, $pluralLabel): void {
                $errors = [];
                foreach ($records as $record) {
                    try {
                        $record->setAttribute('parent_id', $data['parent_id'] ?? null);
                        $record->save();
                    } catch (\RuntimeException $e) {
                        logger()->warning($resourceName.': moveToParent failed', [
                            $idKey => $record->getKey(),
                            'new_parent_id' => $data['parent_id'] ?? null,
                            'error' => $e->getMessage(),
                        ]);
                        $nameRaw = $record->getAttribute('internal_name');
                        $errors[] = is_scalar($nameRaw) ? (string) $nameRaw : '';
                    }
                }

                if (empty($errors)) {
                    Notification::make()
                        ->success()
                        ->title($pluralLabel.' moved')
                        ->send();
                } else {
                    Notification::make()
                        ->danger()
                        ->title('Some '.strtolower($pluralLabel).' could not be moved')
                        ->body('The following '.strtolower($pluralLabel).' would create a circular hierarchy: '.implode(', ', $errors))
                        ->send();
                }
            })
            ->deselectRecordsAfterCompletion();
    }
}
