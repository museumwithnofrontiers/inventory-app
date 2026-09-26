<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\TagResource;
use App\Filament\Resources\TagResource\Pages\ListTag;
use App\Models\Tag;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class TagSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_tag_resource_handles_a_ten_thousand_row_dataset(): void
    {
        $user = $this->createReferenceDataUser();
        $this->seedTags();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/tags');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Tag::query()
            ->orderBy('description')
            ->limit(10)
            ->get();

        $expectedSecondPage = Tag::query()
            ->orderBy('description')
            ->forPage(2, 10)
            ->get();

        $expectedSortedDescending = Tag::query()
            ->orderByDesc('description')
            ->limit(10)
            ->get();

        $keyword = Tag::query()->where('category', 'keyword')->firstOrFail();
        $target = Tag::query()->where('description', 'Tag 09999')->firstOrFail();
        $nonTarget = Tag::query()->where('description', 'Tag 00000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListTag::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->call('gotoPage', 2)
            ->assertCanSeeTableRecords($expectedSecondPage, inOrder: true);

        Livewire::actingAs($user)
            ->test(ListTag::class)
            ->filterTable('category', 'keyword')
            ->assertCanSeeTableRecords([$keyword]);

        Livewire::actingAs($user)
            ->test(ListTag::class)
            ->searchTable('Tag 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget])
            ->searchTable(null)
            ->sortTable('description', 'desc')
            ->assertCanSeeTableRecords($expectedSortedDescending, inOrder: true);
    }

    protected function seedTags(): void
    {
        $timestamp = Carbon::now();
        $categories = array_keys(TagResource::categoryOptions());

        $rows = Tag::factory()
            ->count(10_000)
            ->sequence(fn (Sequence $sequence): array => [
                'internal_name' => sprintf('tag-%05d', $sequence->index),
                'description' => sprintf('Tag %05d', $sequence->index),
                'category' => $categories[$sequence->index % count($categories)],
                'backward_compatibility' => sprintf('tag-%05d', $sequence->index),
            ])
            ->make()
            ->map(fn (Tag $tag): array => [
                ...$tag->getAttributes(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->all();

        foreach (array_chunk($rows, 1000) as $chunk) {
            Tag::query()->insert($chunk);
        }
    }
}
