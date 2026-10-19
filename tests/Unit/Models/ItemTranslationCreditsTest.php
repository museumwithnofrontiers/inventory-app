<?php

namespace Tests\Unit\Models;

use App\Enums\CreditRole;
use App\Models\Author;
use App\Models\ItemTranslation;
use App\Models\ItemTranslationAuthor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ItemTranslationCreditsTest extends TestCase
{
    use RefreshDatabase;

    public function test_attaching_through_a_role_relation_records_that_role(): void
    {
        $translation = ItemTranslation::factory()->create();
        $author = Author::factory()->create();

        $translation->translatorCredits()->attach($author->id, ['display_order' => 2]);

        $this->assertDatabaseHas('item_translation_author', [
            'item_translation_id' => $translation->id,
            'author_id' => $author->id,
            'role' => CreditRole::TRANSLATOR->value,
            'display_order' => 2,
        ]);
        $this->assertCount(0, $translation->authorCredits()->get());
        $this->assertCount(1, $translation->translatorCredits()->get());
    }

    public function test_a_role_lists_its_people_in_display_order(): void
    {
        $translation = ItemTranslation::factory()->create();
        $second = Author::factory()->create();
        $first = Author::factory()->create();

        $translation->authorCredits()->attach($second->id, ['display_order' => 1]);
        $translation->authorCredits()->attach($first->id, ['display_order' => 0]);

        $this->assertSame(
            [$first->id, $second->id],
            $translation->authorCredits()->pluck('authors.id')->all()
        );
    }

    public function test_the_same_person_can_hold_two_roles_and_each_is_edited_and_detached_alone(): void
    {
        $translation = ItemTranslation::factory()->create();
        $author = Author::factory()->create();

        $translation->authorCredits()->attach($author->id, ['display_order' => 0]);
        $translation->textCopyEditorCredits()->attach($author->id, ['display_order' => 0]);
        $this->assertCount(2, $translation->credits()->get());

        /** @var ItemTranslationAuthor $pivot */
        $pivot = $translation->textCopyEditorCredits()->firstOrFail()->getRelationValue('pivot');
        $pivot->update(['display_order' => 5]);

        $this->assertDatabaseHas('item_translation_author', [
            'author_id' => $author->id,
            'role' => CreditRole::AUTHOR->value,
            'display_order' => 0,
        ]);
        $this->assertDatabaseHas('item_translation_author', [
            'author_id' => $author->id,
            'role' => CreditRole::TEXT_COPY_EDITOR->value,
            'display_order' => 5,
        ]);

        $translation->textCopyEditorCredits()->detach($author->id);

        $this->assertDatabaseMissing('item_translation_author', [
            'author_id' => $author->id,
            'role' => CreditRole::TEXT_COPY_EDITOR->value,
        ]);
        $this->assertDatabaseHas('item_translation_author', [
            'author_id' => $author->id,
            'role' => CreditRole::AUTHOR->value,
        ]);
    }

    public function test_credits_go_with_their_translation(): void
    {
        $translation = ItemTranslation::factory()->create();
        $author = Author::factory()->create();
        $translation->authorCredits()->attach($author->id);

        $translation->delete();

        $this->assertDatabaseMissing('item_translation_author', ['author_id' => $author->id]);
        $this->assertModelExists($author);
    }
}
