<?php

namespace App\Http\Requests\Api;

use App\Models\PublicationTranslation;
use App\Rules\IncludeRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePublicationTranslationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $translation = $this->route('publicationTranslation');
        $current = $translation instanceof PublicationTranslation ? $translation : null;

        return [
            'id' => ['prohibited'],
            'publication_id' => ['sometimes', 'required', 'uuid', 'exists:publications,id'],
            'language_id' => [
                'sometimes', 'required', 'string', 'size:3', 'exists:languages,id',
                Rule::unique('publication_translations', 'language_id')
                    ->where('publication_id', $this->input('publication_id', $current?->publication_id))
                    ->where('context_id', $this->input('context_id', $current?->context_id))
                    ->ignore($current?->id),
            ],
            'context_id' => ['sometimes', 'required', 'uuid', 'exists:contexts,id'],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'introduction' => ['nullable', 'string'],
            'author_credit' => ['nullable', 'string'],
            'photography_credit' => ['nullable', 'string'],
            'coordination_credit' => ['nullable', 'string'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
            'extra' => ['nullable', 'array'],
            'include' => ['sometimes', 'string', new IncludeRule('publication_translation')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'language_id.unique' => 'A translation for this publication, language and context already exists.',
        ];
    }
}
