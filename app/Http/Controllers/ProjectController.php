<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexProjectRequest;
use App\Http\Requests\Api\ShowProjectRequest;
use App\Http\Requests\Api\StoreProjectRequest;
use App\Http\Requests\Api\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ProjectController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexProjectRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = Project::query();
        if (! empty($includes)) {
            $query->with($includes);
        }

        $paginator = $query->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return ProjectResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreProjectRequest $request): ProjectResource
    {
        $validated = $request->validated();
        $project = Project::create($validated);
        $project->refresh();
        // By default include context and language for store response; also honor requested includes
        $requested = IncludeParser::fromRequest($request, AllowList::for('project'));
        $project->load(array_values(array_unique(array_merge(['context', 'language'], $requested))));

        return new ProjectResource($project);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowProjectRequest $request, Project $project): ProjectResource
    {
        $includes = $request->getIncludeParams();
        if (! empty($includes)) {
            $project->load($includes);
        }

        return new ProjectResource($project);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateProjectRequest $request, Project $project): ProjectResource
    {
        $validated = $request->validated();
        $project->update($validated);
        $project->refresh();
        // By default include context and language for update response; also honor requested includes
        $requested = IncludeParser::fromRequest($request, AllowList::for('project'));
        $project->load(array_values(array_unique(array_merge(['context', 'language'], $requested))));

        return new ProjectResource($project);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Project $project): Response
    {
        $project->delete();

        return response()->noContent();
    }
}
