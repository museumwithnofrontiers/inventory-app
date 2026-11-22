<?php

namespace App\Support\Documentation\OperationTransformers;

use Dedoc\Scramble\Contracts\OperationTransformer;
use Dedoc\Scramble\Support\Generator\Operation;
use Dedoc\Scramble\Support\Generator\Response;
use Dedoc\Scramble\Support\RouteInfo;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Documents a `store` action's success as 201 Created (`store`, `storeForItem`, ...).
 *
 * Every such action returns the resource of the model it has just created, and Laravel answers
 * a JsonResource whose model was recently created with 201. Scramble cannot see that from the
 * code and documents 200.
 */
class CreatedStatus implements OperationTransformer
{
    public function handle(Operation $operation, RouteInfo $routeInfo): void
    {
        $returnType = $routeInfo->reflectionMethod()?->getReturnType();
        if (! str_starts_with((string) $routeInfo->methodName(), 'store')
            || ! $returnType instanceof \ReflectionNamedType
            || ! is_a($returnType->getName(), JsonResource::class, true)) {
            return;
        }

        foreach ($operation->responses ?? [] as $response) {
            if ($response instanceof Response && (int) $response->code === 200) {
                $response->setCode(201);
            }
        }
    }
}
