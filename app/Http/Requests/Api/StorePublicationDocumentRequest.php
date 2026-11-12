<?php

namespace App\Http\Requests\Api;

use App\Enums\PublicationDocumentKind;
use App\Http\Requests\Api\Concerns\AuthorizesPublicationUpdate;
use App\Models\Publication;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Records a document whose file is already on the private documents disk
 * (as the ItemDocument API does). A document is part of its publication:
 * recording one requires `update` on the publication.
 */
class StorePublicationDocumentRequest extends FormRequest
{
    use AuthorizesPublicationUpdate;

    public function authorize(): bool
    {
        return $this->userMayUpdatePublication($this->route('publication'));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $publication = $this->route('publication');

        return [
            'id' => ['prohibited'],
            'kind' => ['required', Rule::enum(PublicationDocumentKind::class)],
            'publication_edition_id' => [
                'nullable', 'uuid',
                Rule::exists('publication_editions', 'id')
                    ->where('publication_id', $publication instanceof Publication ? $publication->id : null),
            ],
            'language_id' => ['nullable', 'string', 'size:3', 'exists:languages,id'],
            // The stored name /doc serves: a UUID and .pdf
            'path' => ['required', 'string', 'regex:/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.pdf$/', 'unique:publication_documents,path'],
            'original_name' => ['required', 'string', 'max:255'],
            'mime_type' => ['required', 'string', 'in:application/pdf'],
            'size' => ['required', 'integer', 'min:1'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'backward_compatibility' => ['nullable', 'string', 'max:255', 'unique:publication_documents,backward_compatibility'],
            'extra' => ['nullable', 'array'],
        ];
    }
}
