<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\HasIncludes;
use App\Rules\IncludeRule;
use Illuminate\Foundation\Http\FormRequest;

class ShowVisitInformationRequest extends FormRequest
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
            'include' => ['sometimes', 'string', new IncludeRule('visit_information')],
        ];
    }

    protected function getIncludeAllowlistKey(): string
    {
        return 'visit_information';
    }
}
