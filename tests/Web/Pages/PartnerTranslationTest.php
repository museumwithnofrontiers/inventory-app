<?php

namespace Tests\Web\Pages;

use App\Models\Partner;
use App\Models\PartnerTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Web\Traits\AuthenticatesWebRequests;
use Tests\Web\Traits\TestsWebCrud;

class PartnerTranslationTest extends TestCase
{
    use AuthenticatesWebRequests;
    use RefreshDatabase;
    use TestsWebCrud;

    protected function getRouteName(): string
    {
        return 'partner-translations';
    }

    protected function getModelClass(): string
    {
        return PartnerTranslation::class;
    }

    protected function getFormData(): array
    {
        $data = PartnerTranslation::factory()->make()->toArray();

        // The legacy /web form has no fax field (only Filament and the API edit it),
        // so posting one would assert a value this form never saves
        unset($data['contact_fax']);

        // Convert JSON fields (extra) from object/array to JSON string if needed
        if (isset($data['extra']) && (is_object($data['extra']) || is_array($data['extra']))) {
            $data['extra'] = json_encode($data['extra']);
        }

        return $data;
    }

    /**
     * Override to exclude JSON fields that get double-encoded
     */
    protected function getDatabaseAssertions(array $data): array
    {
        return array_diff_key($data, array_flip(['extra', 'contact_phones', 'contact_emails', '_token', '_method']));
    }

    public function test_index_page_displays(): void
    {
        $partner = Partner::factory()->create();
        PartnerTranslation::factory()->count(3)->forPartner($partner->id)->create();

        $response = $this->get(route($this->getRouteName().'.index', ['partner_id' => $partner->id]));

        $response->assertOk()
            ->assertViewIs($this->getIndexView());
    }
}
