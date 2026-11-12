<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\HasIncludes;
use App\Rules\IncludeRule;
use Illuminate\Foundation\Http\FormRequest;

class ShowPublicationEditionRequest extends FormRequest
{
    use HasIncludes;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'include' => ['sometimes', 'string', new IncludeRule('publication_edition')],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'publication_edition';
    }
}
