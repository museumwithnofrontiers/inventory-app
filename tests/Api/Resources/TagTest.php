<?php

namespace Tests\Api\Resources;

use App\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class TagTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'tag';
    }

    protected function getModelClass(): string
    {
        return Tag::class;
    }

    /**
     * The categories a publication's tags take: legacy subjects, themes
     * (books_themes) and target readers (books_targetreaders).
     *
     * @return array<string, array{0: string}>
     */
    public static function publicationTagCategoryProvider(): array
    {
        return [
            'subject' => ['subject'],
            'theme' => ['theme'],
            'audience' => ['audience'],
        ];
    }

    #[DataProvider('publicationTagCategoryProvider')]
    public function test_a_tag_takes_a_publication_tag_category(string $category): void
    {
        $this->postJson(route('tag.store'), [
            'internal_name' => "publication {$category}",
            'description' => "Publication {$category}",
            'category' => $category,
        ])->assertCreated()
            ->assertJsonPath('data.category', $category);

        $tag = Tag::factory()->create(['category' => 'keyword']);

        $this->patchJson(route('tag.update', $tag), [
            'internal_name' => $tag->internal_name,
            'description' => $tag->description,
            'category' => $category,
        ])->assertOk()
            ->assertJsonPath('data.category', $category);
    }

    public function test_an_unknown_tag_category_is_refused(): void
    {
        $this->postJson(route('tag.store'), [
            'internal_name' => 'unknown category',
            'description' => 'Unknown category',
            'category' => 'readership',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['category']);

        $tag = Tag::factory()->create(['category' => 'keyword']);

        $this->patchJson(route('tag.update', $tag), [
            'internal_name' => $tag->internal_name,
            'description' => $tag->description,
            'category' => 'readership',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['category']);
    }
}
