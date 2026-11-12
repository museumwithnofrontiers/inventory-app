<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\HasIncludes;
use App\Models\PublicationDocument;
use App\Models\User;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ShowPublicationDocumentRequest extends FormRequest
{
    use HasIncludes;

    public function authorize(): bool
    {
        $user = $this->user();
        $document = $this->route('publicationDocument');

        return $user instanceof User
            && (! $document instanceof PublicationDocument || $user->can('view', $document));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'include' => ['sometimes', 'string', new IncludeRule('publication_document')],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'publication_document';
    }
}
