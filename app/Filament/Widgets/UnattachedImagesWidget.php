<?php

namespace App\Filament\Widgets;

use Filament\Actions\Action;
use App\Filament\Resources\AvailableImageResource;
use App\Filament\Support\MarkdownState;
use App\Models\AvailableImage;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;

class UnattachedImagesWidget extends BaseWidget
{
    protected static ?int $sort = 5;

    protected int|string|array $columnSpan = 'full';

    public static function canView(): bool
    {
        return auth()->user()?->can('viewAny', AvailableImage::class) ?? false;
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(
                fn (): Builder => AvailableImage::query()
                    ->select(['id', 'path', 'comment', 'original_name', 'created_at'])
                    ->latest()
                    ->limit(10),
            )
            ->paginated(false)
            ->columns([
                ImageColumn::make('path')
                    ->label('Preview')
                    ->getStateUsing(fn (AvailableImage $record): string => route('filament.admin.available-image.view', ['availableImage' => $record->id]))
                    ->height(40)
                    ->width(40),
                TextColumn::make('original_name')
                    ->label('Filename')
                    ->searchable(false)
                    ->sortable(false)
                    ->url(fn (AvailableImage $record): string => AvailableImageResource::getUrl('view', ['record' => $record])),
                TextColumn::make('comment')
                    ->label('Comment')
                    ->formatStateUsing(MarkdownState::excerpt(50))
                    ->sortable(false),
                TextColumn::make('created_at')
                    ->label('Uploaded')
                    ->dateTime()
                    ->sortable(false),
            ])
            ->heading('Available Images (Not Yet Attached)')
            ->emptyStateHeading('No unattached images')
            ->emptyStateDescription('All uploaded images have been attached to records.')
            ->headerActions([
                Action::make('viewAll')
                    ->label('View all available images')
                    ->icon('heroicon-o-photo')
                    ->url(AvailableImageResource::getUrl('index')),
            ]);
    }
}
