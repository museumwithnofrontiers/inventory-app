<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ProjectResource\Pages\ListProject;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ProjectSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_project_resource_handles_a_ten_thousand_row_dataset(): void
    {
        $user = $this->createViewOnlyUser();
        $this->seedProjects();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/projects');

        $response->assertOk();
        $this->assertLessThan(50, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Project::query()
            ->orderBy('internal_name')
            ->limit(10)
            ->get();

        $expectedSecondPage = Project::query()
            ->orderBy('internal_name')
            ->forPage(2, 10)
            ->get();

        $expectedSortedDescending = Project::query()
            ->orderByDesc('internal_name')
            ->limit(10)
            ->get();

        $target = Project::query()->where('internal_name', 'Project 09999')->firstOrFail();
        $nonTarget = Project::query()->where('internal_name', 'Project 00000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListProject::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->call('gotoPage', 2)
            ->assertCanSeeTableRecords($expectedSecondPage, inOrder: true)
            ->searchTable('Project 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget])
            ->searchTable(null)
            ->sortTable('internal_name', 'desc')
            ->assertCanSeeTableRecords($expectedSortedDescending, inOrder: true);
    }

    protected function seedProjects(): void
    {
        $timestamp = Carbon::now();

        $rows = Project::factory()
            ->count(10_000)
            ->sequence(fn (Sequence $sequence): array => [
                'internal_name' => sprintf('Project %05d', $sequence->index),
                'backward_compatibility' => sprintf('prj-%05d', $sequence->index),
                'is_enabled' => $sequence->index % 2 === 0,
                'is_launched' => $sequence->index % 3 === 0,
                'launch_date' => Carbon::create(2025, 1, 1)->addDays($sequence->index)->toDateString(),
            ])
            ->make()
            ->map(fn (Project $project): array => [
                ...$project->getAttributes(),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])
            ->all();

        foreach (array_chunk($rows, 1000) as $chunk) {
            Project::query()->insert($chunk);
        }
    }
}
