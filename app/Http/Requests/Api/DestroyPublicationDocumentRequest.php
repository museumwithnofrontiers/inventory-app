<?php

namespace App\Http\Requests\Api;

use App\Models\PublicationDocument;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Deleting a document (and its file) requires `update` on its publication.
 */
class DestroyPublicationDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $document = $this->route('publicationDocument');

        return $user instanceof User
            && (! $document instanceof PublicationDocument || $user->can('delete', $document));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
