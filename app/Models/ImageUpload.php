<?php

namespace App\Models;

use Database\Factories\ImageUploadFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;

/**
 * @property string|null $path
 * @property string|null $name
 * @property string|null $extension
 * @property string|null $mime_type
 * @property int|null $size
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ImageUpload extends Model
{
    /** @use HasFactory<ImageUploadFactory> */
    use HasFactory;

    use HasUuids;

    protected $fillable = [
        'path',
        'name',
        'extension',
        'mime_type',
        'size',
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

    /**
     * Where the uploaded file sits on the uploads disk
     * (`localstorage.uploads.images`), or null without a path.
     *
     * `path` holds the filename (the API stores it so), but the panel's
     * FileUpload hands back `<directory>/<filename>`: both resolve to the
     * same file in the configured uploads directory.
     */
    public function storagePath(): ?string
    {
        if ($this->path === null || $this->path === '') {
            return null;
        }

        return trim(Config::string('localstorage.uploads.images.directory'), '/').'/'.basename($this->path);
    }
}
