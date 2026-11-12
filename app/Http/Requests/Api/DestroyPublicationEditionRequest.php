<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\AuthorizesPublicationUpdate;
use App\Models\PublicationEdition;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Deleting an edition requires `update` on its publication.
 */
class DestroyPublicationEditionRequest extends FormRequest
{
    use AuthorizesPublicationUpdate;

    public function authorize(): bool
    {
        $edition = $this->route('publicationEdition');

        return $this->userMayUpdatePublication($edition instanceof PublicationEdition ? $edition->publication : null);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
