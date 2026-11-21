<?php

namespace App\Filament\Support;

use App\Enums\PartnerLevel;
use App\Models\CollectionPartner;
use App\Models\Partner;
use App\Support\Markdown\MarkdownText;
use Closure;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Get;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\HtmlString;

/**
 * Shared Filament helpers for the collection_partner pivot (`level`,
 * `visible`, `parent_partner_id`) — M7 story A2.2 (#1901). Used identically
 * by both sides of the pivot: CollectionResource\PartnersRelationManager
 * (OWNER_COLLECTION) and PartnerResource\CollectionParticipationsRelationManager
 * (OWNER_PARTNER).
 */
class CollectionPartnerPivot
{
    /** The relation manager sits on a Collection; its rows are partners. */
    public const OWNER_COLLECTION = 'collection';

    /** The relation manager sits on a Partner; its rows are collections. */
    public const OWNER_PARTNER = 'partner';

    /**
     * The pivot's own editable fields — level, visible and the parent
     * partner — shared by both managers' Attach and Edit-pivot forms.
     *
     * @param  self::OWNER_*  $owner  which side of the pivot the manager sits on
     * @return array<int, Component>
     */
    public static function pivotFormFields(string $owner): array
    {
        return [
            Select::make('level')
                ->label('Level')
                ->options(PartnerLevel::options())
                ->required(),
            Toggle::make('visible')
                ->label('Visible')
                ->default(true),
            self::parentPartnerField($owner),
        ];
    }

    /**
     * The Attach form: {@see self::pivotFormFields()} plus the fixed
     * `collection_type` discriminator (always 'collection' — this pivot table
     * also carries non-collection rows, per Collection::partners()'s own
     * `wherePivot('collection_type', '=', 'collection')`). Never part of the
     * Edit-pivot form: it's set once, at attach time, not user-editable.
     *
     * @param  self::OWNER_*  $owner
     * @return array<int, Component>
     */
    public static function attachFormFields(string $owner): array
    {
        return [
            ...self::pivotFormFields($owner),
            Hidden::make('collection_type')->default('collection'),
        ];
    }

    /**
     * The partner this partner takes part through, in the same collection
     * (an associated partner under its main partner). Offered from the
     * partners the collection already lists, never the partner itself, and
     * validated the same way, since a parent outside the collection would
     * nest a partner under a museum the collection never shows.
     *
     * @param  self::OWNER_*  $owner
     */
    public static function parentPartnerField(string $owner): Select
    {
        return Select::make('parent_partner_id')
            ->label('Parent partner')
            ->helperText('Another partner of this collection that this partner takes part through (an associated partner). Leave empty for none.')
            ->searchable()
            ->nullable()
            ->getSearchResultsUsing(function (string $search, RelationManager $livewire, ?Model $record, Get $get) use ($owner): array {
                [$collectionId, $partnerId] = self::pair($owner, $livewire, $record, $get);
                if ($collectionId === null) {
                    return [];
                }

                return PartnerDisplayLabel::withDisplayLabel(
                    RecordSelect::applyBoundedSearch(self::parentCandidates($collectionId, $partnerId), $search)
                )
                    ->get()
                    ->mapWithKeys(fn (Partner $partner): array => [
                        $partner->id => MarkdownText::plain($partner->display_label ?: $partner->internal_name),
                    ])
                    ->all();
            })
            ->getOptionLabelUsing(fn (mixed $value): string => PartnerDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''))
            ->rules([
                fn (RelationManager $livewire, ?Model $record, Get $get): Closure => function (string $attribute, mixed $value, Closure $fail) use ($owner, $livewire, $record, $get): void {
                    if ($value === null || $value === '') {
                        return;
                    }
                    [$collectionId, $partnerId] = self::pair($owner, $livewire, $record, $get);
                    if ($collectionId === null
                        || ! is_string($value)
                        || ! self::parentCandidates($collectionId, $partnerId)->whereKey($value)->exists()) {
                        $fail('The parent partner must be another partner of this collection.');
                    }
                },
            ]);
    }

    /**
     * The partners a row of this collection may name as its parent: the
     * collection's own (`collection`) partners, the partner itself excepted.
     *
     * @return Builder<Partner>
     */
    public static function parentCandidates(string $collectionId, ?string $partnerId): Builder
    {
        return Partner::query()
            ->whereIn('partners.id', CollectionPartner::query()
                ->select('partner_id')
                ->where('collection_id', $collectionId)
                ->where('collection_type', 'collection'))
            ->when($partnerId !== null, fn (Builder $query): Builder => $query->whereKeyNot($partnerId));
    }

    /**
     * After partners leave a collection, the rows of that collection that
     * named one of them as their parent no longer have one.
     *
     * @param  array<int, string>  $partnerIds
     */
    public static function clearParentReferences(string $collectionId, array $partnerIds): void
    {
        if ($partnerIds === []) {
            return;
        }

        CollectionPartner::query()
            ->where('collection_id', $collectionId)
            ->where('collection_type', 'collection')
            ->whereIn('parent_partner_id', $partnerIds)
            ->update(['parent_partner_id' => null]);
    }

    /**
     * The collection and the partner a form is about: the manager's owner on
     * one side, the row being edited (Edit) or the record being picked
     * (Attach, `recordId`) on the other.
     *
     * @param  self::OWNER_*  $owner
     * @return array{0: string|null, 1: string|null} [collection id, partner id]
     */
    private static function pair(string $owner, RelationManager $livewire, ?Model $record, Get $get): array
    {
        $ownerKey = $livewire->getOwnerRecord()->getKey();
        $picked = $get('recordId');
        $other = is_string($picked) && $picked !== '' ? $picked : $record?->getKey();

        $ownerKey = is_string($ownerKey) ? $ownerKey : null;
        $other = is_string($other) ? $other : null;

        return $owner === self::OWNER_COLLECTION ? [$ownerKey, $other] : [$other, $ownerKey];
    }

    public static function levelColumn(): TextColumn
    {
        return TextColumn::make('pivot.level')
            ->label('Level')
            ->formatStateUsing(fn (?string $state): ?string => $state ? PartnerLevel::from($state)->label() : null)
            ->sortable();
    }

    /**
     * The partner a partner takes part through in the collection (associated
     * partners). The importer writes it on project-tier rows (M16 J2 #2709);
     * the panel sets it on collection rows ({@see self::parentPartnerField()}).
     */
    public static function parentPartnerColumn(): TextColumn
    {
        return TextColumn::make('pivot.parent_partner_id')
            ->label('Parent partner')
            ->formatStateUsing(fn (?string $state): ?HtmlString => $state
                ? MarkdownText::inline(Partner::query()->whereKey($state)->value('internal_name'))
                : null)
            ->placeholder('—')
            ->toggleable();
    }

    public static function visibleColumn(): IconColumn
    {
        return IconColumn::make('pivot.visible')
            ->label('Visible')
            ->boolean();
    }
}
