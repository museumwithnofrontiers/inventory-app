<?php

namespace App\Mcp\Tools\Pipeline;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Queue\Failed\FailedJobProviderInterface;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Queue;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('queue_status')]
#[Description('The queue the app runs its background jobs on (such as document processing): its connection, how many jobs wait, and the most recent failed jobs with their first error line.')]
#[IsReadOnly]
class QueueStatus extends PipelineTool
{
    public function handle(Request $request, FailedJobProviderInterface $failer): Response|ResponseFactory
    {
        if (! $this->mayObserve($request)) {
            return Response::error('You may not observe the image pipeline.');
        }

        $failed = array_map(fn (object $job): array => [
            'id' => $job->uuid ?? $job->id ?? null,
            'connection' => $job->connection ?? null,
            'queue' => $job->queue ?? null,
            'failed_at' => $job->failed_at ?? null,
            'error' => strtok((string) ($job->exception ?? ''), "\n") ?: null,
        ], $failer->all());

        return Response::structured([
            'connection' => Config::string('queue.default'),
            'pending' => Queue::size(),
            'failed' => $this->capped($failed, (int) $request->get('limit', 20)),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'limit' => $schema->integer()->min(1)->default(20)->description('How many failed jobs to list'),
        ];
    }
}
