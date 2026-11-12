<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationDocumentKind;
use App\Models\PublicationDocument;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Changes a document's metadata. The file, its name and its publication
 * never change.
 */
class UpdatePublicationDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $document = $this->route('publicationDocument');

        return $user instanceof User
            && (! $document instanceof PublicationDocument || $user->can('update', $document));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $document = $this->route('publicationDocument');
        $current = $document instanceof PublicationDocument ? $document : null;

        return [
            'kind' => ['sometimes', Rule::enum(PublicationDocumentKind::class)],
            'publication_edition_id' => [
                'sometimes', 'nullable', 'uuid',
                Rule::exists('publication_editions', 'id')->where('publication_id', $current?->publication_id),
            ],
            'language_id' => ['sometimes', 'nullable', 'string', 'size:3', 'exists:languages,id'],
            'display_order' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'backward_compatibility' => [
                'sometimes', 'nullable', 'string', 'max:255',
                Rule::unique('publication_documents', 'backward_compatibility')->ignore($current?->id),
            ],
            'extra' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
