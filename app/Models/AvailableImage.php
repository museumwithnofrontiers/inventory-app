<?php

namespace App\Models;

use App\Contracts\StreamableImageFile;
use Database\Factories\AvailableImageFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;

/**
 * @property string $id
 * @property string|null $path
 * @property string|null $original_name
 * @property string|null $mime_type
 * @property int|null $size
 * @property string|null $comment
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class AvailableImage extends Model implements StreamableImageFile
{
    /** @use HasFactory<AvailableImageFactory> */
    use HasFactory;

    use HasUuids;

    protected $fillable = [
        'path',
        'original_name',
        'mime_type',
        'size',
        'comment',
        'copyright',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'size' => 'integer',
    ];

    /**
     * Get the columns that should automatically receive a unique identifier.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    public function imageDisk(): string
    {
        return Config::string('localstorage.available.images.disk');
    }

    public function imageStoragePath(): string
    {
        return trim(Config::string('localstorage.available.images.directory'), '/').'/'.$this->path;
    }

    public function imageMimeType(): ?string
    {
        return $this->mime_type ?: null;
    }

    /**
     * The stored filename, never `original_name` - see ItemImage for why.
     */
    public function imageDownloadFilename(): string
    {
        return basename($this->path ?? '');
    }
}
