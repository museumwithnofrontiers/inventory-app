<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\AuthorResource\Pages\ListAuthor;
use App\Models\Author;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class AuthorSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_author_resource_handles_a_ten_thousand_row_dataset(): void
    {
        $user = $this->createReferenceDataUser();
        $this->seedAuthors();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/authors');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Author::query()
            ->orderBy('internal_name')
            ->limit(10)
            ->get();

        $expectedSecondPage = Author::query()
            ->orderBy('internal_name')
            ->forPage(2, 10)
            ->get();

        $expectedSortedDescending = Author::query()
            ->orderByDesc('internal_name')
            ->limit(10)
            ->get();

        $target = Author::query()->where('internal_name', 'Author 09999')->firstOrFail();
        $nonTarget = Author::query()->where('internal_name', 'Author 00000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListAuthor::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->call('gotoPage', 2)
            ->assertCanSeeTableRecords($expectedSecondPage, inOrder: true)
            ->searchTable('Author 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget])
            ->searchTable(null)
            ->sortTable('internal_name', 'desc')
            ->assertCanSeeTableRecords($expectedSortedDescending, inOrder: true);
    }

    protected function seedAuthors(): void
    {
        $timestamp = Carbon::now();

        $rows = Author::factory()
            ->count(10_000)
            ->sequence(fn (Sequence $sequence): array => [
                'id' => (string) Str::uuid(),
                'name' => sprintf('Author Name %05d', $sequence->index),
                'internal_name' => sprintf('Author %05d', $sequence->index),
                'backward_compatibility' => sprintf('author-%05d', $sequence->index),
            ])
            ->make()
            ->map(fn (Author $author): array => [
                ...$author->getAttributes(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->all();

        foreach (array_chunk($rows, 1000) as $chunk) {
            Author::query()->insert($chunk);
        }
    }
}
