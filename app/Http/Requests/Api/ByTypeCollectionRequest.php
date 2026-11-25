<?php

namespace App\Http\Requests\Api;

use App\Enums\CollectionType;
use App\Rules\IncludeRule;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ByTypeCollectionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * The type to validate is a route parameter, not request input.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['type' => $this->route('type')]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(CollectionType::class)],
            'include' => ['sometimes', 'string', new IncludeRule('collection')],
        ];
    }

    /**
     * Get validated include parameters.
     *
     * @return array<int, string>
     */
    public function getIncludeParams(): array
    {
        return IncludeParser::fromRequest($this, AllowList::for('collection'));
    }
}
