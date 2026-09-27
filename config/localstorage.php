<?php

return [
    'uploads' => [
        'images' => [
            /*
            |--------------------------------------------------------------------------
            | The Maximum Size for Image Uploads
            |--------------------------------------------------------------------------
            |
            | This value defines the maximum size for image uploads in bytes. The
            | default is set to 20MB (20480 kilobytes). You can change this value
            | in your .env file using the `UPLOAD_IMAGES_MAX_SIZE` key.
            |
            | Note that this value is used for validation, so it should be set
            | according to your application's requirements.
            | */
            'max_size' => (int) env('UPLOAD_IMAGES_MAX_SIZE', 20480), // in kb

            /*
            |--------------------------------------------------------------------------
            | The Allowed MIME Types for Image Uploads
            |--------------------------------------------------------------------------
            |
            | This value defines the allowed MIME types for image uploads. The
            | default is set to `jpeg,jpg,png`. You can change this value in
            | your .env file using the `UPLOAD_IMAGES_MIME_TYPES` key.
            |
            | Note that this value is used for validation, so it should be set
            | according to your application's requirements.
            |
            */
            'mime' => env('UPLOAD_IMAGES_MIME_TYPES', 'jpeg,jpg,png'),

            /*
            |--------------------------------------------------------------------------
            | The Disk for Image Uploads
            |--------------------------------------------------------------------------
            |
            | This disk is used to store uploaded images. It is defined in the
            | filesystem configuration. The default disk is set to **local**, but you
            | can change it to any other disk defined in your filesystem configuration.
            |
            */
            'disk' => env('UPLOAD_IMAGES_DISK', 'local'),

            /*
            |--------------------------------------------------------------------------
            | The Directory for Image Uploads
            |--------------------------------------------------------------------------
            |
            | This directory is used to store uploaded images. It is relative to the
            | _disk_ disk.
            |
            */
            'directory' => env('UPLOAD_IMAGES_DIRECTORY', 'image_uploads'),
        ],

        'documents' => [
            /*
            |--------------------------------------------------------------------------
            | The Disk for Pending Document Uploads
            |--------------------------------------------------------------------------
            |
            | This private disk holds a document while DocumentUploadListener
            | validates it on the queue (M7 Story A4.2, #1906). Never `public`.
            |
            */
            'disk' => env('UPLOAD_DOCUMENTS_DISK', 'local'),

            /*
            |--------------------------------------------------------------------------
            | The Directory for Pending Document Uploads
            |--------------------------------------------------------------------------
            |
            | Relative to the _disk_ disk above.
            |
            */
            'directory' => env('UPLOAD_DOCUMENTS_DIRECTORY', 'document_uploads'),

            /*
            |--------------------------------------------------------------------------
            | The Minimum Size for Document Uploads
            |--------------------------------------------------------------------------
            |
            | In kilobytes. Rejects empty/near-empty files.
            |
            */
            'min_size' => (int) env('UPLOAD_DOCUMENTS_MIN_SIZE', 1),

            /*
            |--------------------------------------------------------------------------
            | The Maximum Size for Document Uploads
            |--------------------------------------------------------------------------
            |
            | In kilobytes. The default is 20MB (20480 kilobytes), matching
            | uploads.images.max_size's default.
            |
            */
            'max_size' => (int) env('UPLOAD_DOCUMENTS_MAX_SIZE', 20480),

            /*
            |--------------------------------------------------------------------------
            | The Allowed Extensions for Document Uploads
            |--------------------------------------------------------------------------
            |
            | Comma-separated extension allow-list.
            |
            */
            'extensions' => env('UPLOAD_DOCUMENTS_EXTENSIONS', 'pdf'),

            /*
            |--------------------------------------------------------------------------
            | The Allowed MIME Types for Document Uploads
            |--------------------------------------------------------------------------
            |
            | Comma-separated MIME allow-list, checked against the framework's
            | own (Symfony) guesser — not the browser-declared type.
            |
            */
            'mime' => env('UPLOAD_DOCUMENTS_MIME_TYPES', 'application/pdf'),
        ],
    ],

    'available' => [
        'images' => [
            /*
            |--------------------------------------------------------------------------
            | The Maximum Width and Height for Available Images
            |--------------------------------------------------------------------------
            |
            | These values define the maximum width and height for available images.
            | The default is set to 3840x2160 (4K resolution). You can change
            | these values in your .env file using the `AVAILABLE_IMAGES_MAX_WIDTH` and
            | `AVAILABLE_IMAGES_MAX_HEIGHT` keys.
            |
            */
            'max_width' => env('AVAILABLE_IMAGES_MAX_WIDTH', 3840),
            'max_height' => env('AVAILABLE_IMAGES_MAX_HEIGHT', 2160),

            /*
            |--------------------------------------------------------------------------
            | The Disk for Available Images
            |--------------------------------------------------------------------------
            |
            | This disk is used to store available images that are ready to be
            | attached to Items, Details, or Partners. It is defined in the
            | filesystem configuration. It is also where an attached image's
            | pristine original lives for its whole lifetime (M9 §10) - the
            | default is the private **image-originals** disk, never `public`;
            | nothing here should ever be web-reachable.
            |
            */
            'disk' => env('AVAILABLE_IMAGES_DISK', 'image-originals'),

            /*
            |--------------------------------------------------------------------------
            | The Directory for Available Images
            |--------------------------------------------------------------------------
            |
            | This directory is used to store available images that are ready to be
            | attached. It is relative to the _disk_ disk.
            |
            */
            'directory' => env('AVAILABLE_IMAGES_DIRECTORY', 'images'),
        ],
    ],

    'pictures' => [
        /*
        |--------------------------------------------------------------------------
        | The Disk for ItemImages (formerly Pictures)
        |--------------------------------------------------------------------------
        |
        | This disk is used to store images that are attached to Items via the
        | ItemImage model. It is defined in the filesystem configuration. The default
        | disk is set to **public**, but you can change it to any other disk
        | defined in your filesystem configuration.
        |
        */
        'disk' => env('PICTURES_DISK', 'public'),

        /*
        |--------------------------------------------------------------------------
        | The Directory for ItemImages (formerly Pictures)
        |--------------------------------------------------------------------------
        |
        | This directory is used to store images that are attached to Items via the
        | ItemImage model. It is relative to the _disk_ disk.
        |
        */
        'directory' => env('PICTURES_DIRECTORY', 'pictures'),
    ],

    'documents' => [
        /*
        |--------------------------------------------------------------------------
        | The Disk for Item Documents
        |--------------------------------------------------------------------------
        |
        | This disk is used to store documents (PDFs, etc.) attached to Items.
        | The default is the private **document-originals** disk (M7 Story
        | A4.2, #1906) — never `public`; nothing here should ever be
        | web-reachable, the same rule CLAUDE.md's image pipeline enforces for
        | `image-originals`.
        |
        */
        'disk' => env('DOCUMENTS_DISK', 'document-originals'),

        /*
        |--------------------------------------------------------------------------
        | The Directory for Item Documents
        |--------------------------------------------------------------------------
        |
        | This directory is used to store documents attached to Items.
        | It is relative to the _disk_ disk.
        |
        */
        'directory' => env('DOCUMENTS_DIRECTORY', 'documents'),
    ],
];
