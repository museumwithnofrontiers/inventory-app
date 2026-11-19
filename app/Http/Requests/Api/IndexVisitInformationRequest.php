<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\HasPaginationAndIncludes;
use App\Rules\IncludeRule;
use Illuminate\Foundation\Http\FormRequest;

class IndexVisitInformationRequest extends FormRequest
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
            'include' => ['sometimes', 'string', new IncludeRule('visit_information')],
            'item_id' => ['sometimes', 'uuid'],
            'collection_id' => ['sometimes', 'uuid'],
            'partner_id' => ['sometimes', 'uuid'],
            'language_id' => ['sometimes', 'string', 'size:3'],
            'context_id' => ['sometimes', 'uuid'],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'visit_information';
    }
}
