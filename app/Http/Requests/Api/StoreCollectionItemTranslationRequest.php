<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\ValidatesCollectionItemTranslationTexts;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCollectionItemTranslationRequest extends FormRequest
{
    use ValidatesCollectionItemTranslationTexts;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'id' => ['prohibited'],
            'collection_item_id' => ['required', 'uuid', 'exists:collection_item,id'],
            'language_id' => [
                'required', 'string', 'size:3', 'exists:languages,id',
                Rule::unique('collection_item_translations', 'language_id')
                    ->where('collection_item_id', $this->input('collection_item_id')),
            ],
            ...$this->textRules(),
            'include' => ['sometimes', 'string', new IncludeRule('collection_item_translation')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return $this->textMessages();
    }
}
