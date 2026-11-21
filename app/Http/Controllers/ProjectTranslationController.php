<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexProjectTranslationRequest;
use App\Http\Requests\Api\ShowProjectTranslationRequest;
use App\Http\Requests\Api\StoreProjectTranslationRequest;
use App\Http\Requests\Api\UpdateProjectTranslationRequest;
use App\Http\Resources\ProjectTranslationResource;
use App\Models\ProjectTranslation;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ProjectTranslationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexProjectTranslationRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = ProjectTranslation::query()->with($includes);
        $paginator = $query->paginate(
            $pagination['per_page'],
            ['*'],
            'page',
            $pagination['page']
        );

        return ProjectTranslationResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreProjectTranslationRequest $request): ProjectTranslationResource
    {
        $projectTranslation = ProjectTranslation::create($request->validated());
        $projectTranslation->refresh();
        $projectTranslation->load(IncludeParser::fromRequest($request, AllowList::for('project_translation')));

        return new ProjectTranslationResource($projectTranslation);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowProjectTranslationRequest $request, ProjectTranslation $projectTranslation): ProjectTranslationResource
    {
        $projectTranslation->load($request->getIncludeParams());

        return new ProjectTranslationResource($projectTranslation);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateProjectTranslationRequest $request, ProjectTranslation $projectTranslation): ProjectTranslationResource
    {
        $projectTranslation->update($request->validated());
        $projectTranslation->refresh();
        $projectTranslation->load(IncludeParser::fromRequest($request, AllowList::for('project_translation')));

        return new ProjectTranslationResource($projectTranslation);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ProjectTranslation $projectTranslation): Response
    {
        $projectTranslation->delete();

        return response()->noContent();
    }
}
