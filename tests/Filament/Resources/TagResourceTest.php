<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\LanguageResource;
use App\Filament\Resources\TagResource\Pages\CreateTag;
use App\Filament\Resources\TagResource\Pages\EditTag;
use App\Filament\Resources\TagResource\Pages\ListTag;
use App\Filament\Support\EntityColor;
use App\Models\Language;
use App\Models\Tag;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class TagResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_tag_resource_pages(): void
    {
        $user = $this->createReferenceDataUser();
        $tag = Tag::factory()->keyword()->create([
            'internal_name' => 'woodwork',
            'description' => 'Woodwork',
        ]);

        $this->actingAs($user)->get('/admin/tags')
            ->assertOk()
            ->assertSee('Tags');

        $this->actingAs($user)->get('/admin/tags/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/tags/{$tag->getKey()}/edit")
            ->assertOk()
            ->assertSee('Woodwork');

        $this->actingAs($user)->get("/admin/tags/{$tag->getKey()}")
            ->assertOk()
            ->assertSee('Woodwork');
    }

    public function test_authorized_users_can_create_edit_and_delete_tags(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $tag = Tag::factory()->keyword()->create([
            'internal_name' => 'woodwork',
            'description' => 'Woodwork',
            'language_id' => $language->id,
            'backward_compatibility' => 'tag-01',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTag::class)
            ->fillForm([
                'internal_name' => 'stonework',
                'description' => 'Stonework',
                'category' => 'material',
                'language_id' => $language->id,
                'backward_compatibility' => 'tag-02',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('tags', [
            'internal_name' => 'stonework',
            'description' => 'Stonework',
            'category' => 'material',
            'language_id' => $language->id,
            'backward_compatibility' => 'tag-02',
        ]);

        Livewire::actingAs($user)
            ->test(EditTag::class, [
                'record' => $tag->getRouteKey(),
            ])
            ->assertFormSet([
                'internal_name' => 'woodwork',
                'description' => 'Woodwork',
                'category' => 'keyword',
                'language_id' => $language->id,
                'backward_compatibility' => 'tag-01',
            ])
            ->fillForm([
                'internal_name' => 'wood-carving',
                'description' => 'Wood carving',
                'category' => 'artist',
                'language_id' => $language->id,
                'backward_compatibility' => 'tag-11',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('tags', [
            'id' => $tag->id,
            'internal_name' => 'wood-carving',
            'description' => 'Wood carving',
            'category' => 'artist',
            'backward_compatibility' => 'tag-11',
        ]);

        Livewire::actingAs($user)
            ->test(ListTag::class)
            ->callTableAction(DeleteAction::class, $tag)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('tags', [
            'id' => $tag->id,
        ]);
    }

    public function test_tag_resource_uses_description_as_the_human_label_and_filters_by_category(): void
    {
        $user = $this->createReferenceDataUser();
        $keyword = Tag::factory()->keyword()->create([
            'internal_name' => 'woodwork',
            'description' => 'Woodwork',
        ]);
        $material = Tag::factory()->material()->create([
            'internal_name' => 'marble',
            'description' => 'Marble',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListTag::class)
            ->assertTableColumnFormattedStateSet('description', 'Woodwork', $keyword)
            ->assertTableColumnExists('description', function (TextColumn $column): bool {
                return $column->isBadge();
            }, $keyword)
            ->assertTableColumnExists('description', function (TextColumn $column): bool {
                return $column->getColor('Woodwork') === EntityColor::palette('keyword');
            }, $keyword)
            ->filterTable('category', 'keyword')
            ->assertCanSeeTableRecords([$keyword])
            ->assertCanNotSeeTableRecords([$material]);
    }

    public function test_tag_table_language_column_links_to_language_resource_with_manage_reference_data(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $tag = Tag::factory()->keyword()->create([
            'internal_name' => 'woodwork',
            'language_id' => $language->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListTag::class)
            ->assertTableColumnExists(
                'language.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === LanguageResource::getUrl('view', ['record' => $language]),
                $tag
            );
    }
}
