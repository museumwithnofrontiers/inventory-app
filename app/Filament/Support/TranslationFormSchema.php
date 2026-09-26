<?php

namespace App\Filament\Support;

use App\Models\Author;
use App\Models\Context;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;

class TranslationFormSchema
{
    public static function languageField(): Select
    {
        return Select::make('language_id')
            ->label('Language')
            ->relationship('language', 'internal_name')
            ->searchable()
            ->required();
    }

    public static function contextField(): Select
    {
        return Select::make('context_id')
            ->label('Context')
            ->relationship('context', 'internal_name')
            ->searchable()
            ->required();
    }

    public static function nameField(): TextInput
    {
        return TextInput::make('name')
            ->required()
            ->maxLength(255);
    }

    public static function alternateNameField(): TextInput
    {
        return TextInput::make('alternate_name')
            ->maxLength(255);
    }

    public static function descriptionField(): Textarea
    {
        return Textarea::make('description')
            ->rows(4)
            ->columnSpanFull();
    }

    public static function backwardCompatibilityField(): TextInput
    {
        return TextInput::make('backward_compatibility')
            ->label('Legacy ID')
            ->maxLength(255)
            ->placeholder('Optional legacy identifier');
    }

    /**
     * Returns a searchable Select bound to the authors table.
     *
     * The search is server-side and limited to 50 results to keep the query bounded
     * even when the author catalogue grows large.
     */
    public static function authorSelectField(string $name, string $label): Select
    {
        return Select::make($name)
            ->label($label)
            ->nullable()
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => Author::query()
                ->where('name', 'like', "%{$search}%")
                ->orWhere('internal_name', 'like', "%{$search}%")
                ->orderBy('name')
                ->limit(50)
                ->pluck('name', 'id')
                ->all()
            )
            ->getOptionLabelUsing(function (mixed $v): string {
                $author = Author::query()->whereKey($v)->first();

                return $author !== null ? $author->name : (is_scalar($v) ? (string) $v : '');
            });
    }

    /**
     * $includeIdInSearch is kept for backward compatibility with existing call
     * sites; RecordSelect's locked convention (story #1891) always searches
     * `id` alongside `internal_name` and `backward_compatibility` now, so this
     * flag no longer changes anything.
     */
    public static function itemSelectField(
        string $name = 'item_id',
        string $label = 'Item',
        bool $required = true,
        bool $includeIdInSearch = false
    ): Select {
        return RecordSelect::forItems($name, $label, $required);
    }

    /**
     * $includeIdInSearch is kept for backward compatibility; see itemSelectField().
     */
    public static function collectionSelectField(
        string $name = 'collection_id',
        string $label = 'Collection',
        bool $required = true,
        bool $includeIdInSearch = false
    ): Select {
        return RecordSelect::forCollections($name, $label, $required);
    }

    /**
     * $includeIdInSearch is kept for backward compatibility; see itemSelectField().
     */
    public static function partnerSelectField(
        string $name = 'partner_id',
        string $label = 'Partner',
        bool $required = true,
        bool $includeIdInSearch = false
    ): Select {
        return RecordSelect::forPartners($name, $label, $required);
    }

    public static function contextSelectField(
        string $name = 'context_id',
        string $label = 'Context',
        bool $required = true
    ): Select {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => Context::query()
                ->where('internal_name', 'like', "%{$search}%")
                ->orderBy('internal_name')
                ->limit(50)
                ->pluck('internal_name', 'id')
                ->all()
            )
            ->getOptionLabelUsing(function (mixed $value): string {
                $context = Context::query()->whereKey($value)->first();

                return $context !== null ? $context->internal_name : (is_scalar($value) ? (string) $value : '');
            });

        return static::requiredOrNullable($select, $required);
    }

    public static function extraField(): Textarea
    {
        return ExtraJsonField::formComponent();
    }

    /**
     * @return array<int, Select|Textarea|TextInput>
     */
    public static function make(): array
    {
        return [
            static::languageField(),
            static::contextField(),
            static::nameField(),
            static::alternateNameField(),
            static::descriptionField(),
        ];
    }

    protected static function requiredOrNullable(Select $select, bool $required): Select
    {
        return $required ? $select->required() : $select->nullable();
    }
}
