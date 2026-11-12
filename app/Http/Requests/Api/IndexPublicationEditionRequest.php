<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\HasPaginationAndIncludes;
use App\Rules\IncludeRule;
use Illuminate\Foundation\Http\FormRequest;

class IndexPublicationEditionRequest extends FormRequest
{
    use HasPaginationAndIncludes;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:100',
            'include' => ['sometimes', 'string', new IncludeRule('publication_edition')],
            'publication_id' => ['sometimes', 'uuid'],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'publication_edition';
    }
}
