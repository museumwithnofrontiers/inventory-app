<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\AuthorizesPublicationUpdate;
use App\Http\Requests\Api\Concerns\HasIncludes;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AttachItemPublicationRequest extends FormRequest
{
    use AuthorizesPublicationUpdate;
    use HasIncludes;

    public function authorize(): bool
    {
        return $this->userMayUpdatePublication($this->route('publication'));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'item_id' => ['required', 'uuid', 'exists:items,id'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'extra' => ['nullable', 'array'],
            'include' => ['sometimes', 'string', new IncludeRule('publication')],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'publication';
    }
}
