<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ContextResource\Pages\ListContext;
use App\Models\Context;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ContextSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_context_resource_handles_a_ten_thousand_row_dataset(): void
    {
        $user = $this->createReferenceDataUser();
        $this->seedContexts();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/contexts');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Context::query()
            ->orderBy('internal_name')
            ->limit(10)
            ->get();

        $expectedSecondPage = Context::query()
            ->orderBy('internal_name')
            ->forPage(2, 10)
            ->get();

        $defaultContext = Context::query()->default()->firstOrFail();
        $target = Context::query()->where('internal_name', 'Context 09999')->firstOrFail();
        $nonTarget = Context::query()->where('internal_name', 'Context 00000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListContext::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->call('gotoPage', 2)
            ->assertCanSeeTableRecords($expectedSecondPage, inOrder: true);

        Livewire::actingAs($user)
            ->test(ListContext::class)
            ->filterTable('is_default', true)
            ->assertCanSeeTableRecords([$defaultContext]);

        Livewire::actingAs($user)
            ->test(ListContext::class)
            ->searchTable('Context 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget]);
    }

    protected function seedContexts(): void
    {
        $timestamp = Carbon::now();

        $rows = Context::factory()
            ->count(10_000)
            ->sequence(fn (Sequence $sequence): array => [
                'internal_name' => sprintf('Context %05d', $sequence->index),
                'backward_compatibility' => sprintf('ctx-%05d', $sequence->index),
                'is_default' => $sequence->index === 0,
            ])
            ->make()
            ->map(fn (Context $context): array => [
                ...$context->getAttributes(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->all();

        foreach (array_chunk($rows, 1000) as $chunk) {
            Context::query()->insert($chunk);
        }
    }
}
