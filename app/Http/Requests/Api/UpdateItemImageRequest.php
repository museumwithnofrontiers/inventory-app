<?php

namespace App\Http\Requests\Api;

use App\Rules\IncludeRule;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateItemImageRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Path and item_id are immutable - not allowed in updates
            'original_name' => ['sometimes', 'string', 'max:255'],
            'mime_type' => ['sometimes', 'string', 'max:100', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/'],
            'size' => ['sometimes', 'integer', 'min:1'],
            'alt_text' => ['sometimes', 'nullable', 'string', 'max:500'],
            'photographer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'credit' => ['sometimes', 'nullable', 'string', 'max:500'],
            'display_order' => ['sometimes', 'integer', 'min:1'],
            'include' => ['sometimes', 'string', new IncludeRule('itemImage')],
        ];
    }

    /**
     * Get validated include parameters.
     *
     * @return array<int, string>
     */
    public function getIncludeParams(): array
    {
        return IncludeParser::fromRequest($this, AllowList::for('itemImage'));
    }
}
