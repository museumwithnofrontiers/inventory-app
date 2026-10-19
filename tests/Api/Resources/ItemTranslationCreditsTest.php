<?php

namespace Tests\Api\Resources;

use App\Models\Author;
use App\Models\ItemTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

class ItemTranslationCreditsTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;

    public function test_show_includes_every_credit_with_its_role_and_order(): void
    {
        $translation = ItemTranslation::factory()->create();
        $first = Author::factory()->create();
        $second = Author::factory()->create();
        $translation->authorCredits()->attach($first->id, ['display_order' => 0]);
        $translation->authorCredits()->attach($second->id, ['display_order' => 1]);
        $translation->translatorCredits()->attach($first->id, ['display_order' => 0]);

        $response = $this->getJson(route('item-translation.show', $translation).'?include=credits');

        $response->assertOk()
            ->assertJsonCount(3, 'data.credits')
            ->assertJsonPath('data.credits.0.role', 'author')
            ->assertJsonPath('data.credits.0.author.id', $first->id)
            ->assertJsonPath('data.credits.1.role', 'author')
            ->assertJsonPath('data.credits.1.display_order', 1)
            ->assertJsonPath('data.credits.1.author.id', $second->id)
            ->assertJsonPath('data.credits.2.role', 'translator');
    }

    public function test_show_leaves_credits_out_unless_included(): void
    {
        $translation = ItemTranslation::factory()->create();
        $translation->authorCredits()->attach(Author::factory()->create()->id);

        $this->getJson(route('item-translation.show', $translation))
            ->assertOk()
            ->assertJsonMissingPath('data.credits');
    }
}
