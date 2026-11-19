<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\ValidatesCollectionItemTranslationTexts;
use App\Models\CollectionItemTranslation;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCollectionItemTranslationRequest extends FormRequest
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
        $translation = $this->route('collectionItemTranslation');
        $current = $translation instanceof CollectionItemTranslation ? $translation : null;

        return [
            'id' => ['prohibited'],
            'collection_item_id' => ['prohibited'],
            'language_id' => [
                'sometimes', 'required', 'string', 'size:3', 'exists:languages,id',
                Rule::unique('collection_item_translations', 'language_id')
                    ->where('collection_item_id', $current?->collection_item_id)
                    ->ignore($current?->id),
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
