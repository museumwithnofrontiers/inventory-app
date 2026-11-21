<?php

namespace App\Http\Requests\Api;

use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectTranslationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $uniqueRule = Rule::unique('project_translations')
            ->where(fn (Builder $q) => $q
                ->where('project_id', $this->input('project_id'))
                ->where('language_id', $this->input('language_id'))
            )
            ->ignore($this->route('projectTranslation'));

        return [
            'id' => ['prohibited'],
            'project_id' => ['required', 'uuid', 'exists:projects,id', $uniqueRule],
            'language_id' => ['required', 'string', 'size:3', 'exists:languages,id'],
            'name' => ['required', 'string', 'max:255'],
        ];
    }
}
