<?php

namespace App\Filament\Widgets;

use App\Models\AvailableImage;
use App\Models\ImageUpload;
use App\Support\FileSize;
use App\Support\Images\AttachedImageRegistry;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StorageUsageWidget extends StatsOverviewWidget
{
    protected static ?int $sort = 3;

    public static function canView(): bool
    {
        return auth()->user()?->can('viewAny', AvailableImage::class) ?? false;
    }

    protected function getStats(): array
    {
        $managedBytes = $this->getManagedStorageBytes();
        $availablePoolBytes = $this->getAvailablePoolBytes();
        $pendingBytes = $this->getPendingUploadBytes();

        return [
            Stat::make('Managed Image Storage', FileSize::format($managedBytes))
                ->description('Total across all attached image tables')
                ->icon('heroicon-o-photo'),
            Stat::make('Available Image Pool', FileSize::format($availablePoolBytes))
                ->description('Unattached images awaiting use')
                ->icon('heroicon-o-archive-box'),
            Stat::make('Pending Uploads', FileSize::format($pendingBytes))
                ->description('Private uploads awaiting processing')
                ->icon('heroicon-o-arrow-up-tray')
                ->color('warning'),
        ];
    }

    public function getManagedStorageBytes(): int
    {
        $total = 0;

        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $total += (int) $class::query()->sum('size');
        }

        return $total;
    }

    public function getAvailablePoolBytes(): int
    {
        return (int) AvailableImage::query()->sum('size');
    }

    public function getPendingUploadBytes(): int
    {
        return (int) ImageUpload::query()->sum('size');
    }
}
