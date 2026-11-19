<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCollectionTranslationRequest extends FormRequest
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
            'id' => ['prohibited'],
            'collection_id' => [
                'required',
                'uuid',
                'exists:collections,id',
                Rule::unique('collection_translations')->where(function (Builder $query) {
                    return $query->where('language_id', $this->input('language_id'))
                        ->where('context_id', $this->input('context_id'));
                }),
            ],
            'language_id' => ['required', 'string', 'size:3', 'exists:languages,id'],
            'context_id' => ['required', 'uuid', 'exists:contexts,id'],
            'title' => ['required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'introduction' => ['nullable', 'string'],
            'quote' => ['nullable', 'string'],
            'duration' => ['nullable', 'string', 'max:255'],
            'url' => ['nullable', 'url', 'max:2048'],
            'backward_compatibility' => ['nullable', 'string', 'max:255'],
            'extra' => ['nullable', 'json'],
        ];
    }
}
