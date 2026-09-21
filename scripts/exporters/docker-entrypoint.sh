#!/bin/sh
#
# Runs one dataset exporter inside the compose `exporter` service.
#
#   docker compose run --rm exporter islamicart
#   docker compose run --rm exporter baroqueart --force
#   docker compose --profile jobs run --rm exporter dxa-gallery --instance carpets --force
#
# Everything after the dataset name is passed through to `npm run export`.
#
# `all` is a reserved dataset name: it iterates every
# scripts/exporters/instances/*.json file and runs the matching exporter for
# each, once per run instead of once per site — see the "Batch" section of
# README.md.
#
#   docker compose --profile jobs run --rm exporter all --dry-run
#   docker compose --profile jobs run --rm exporter all --force
#   docker compose --profile jobs run --rm exporter all --force --publish
set -e

EXPORTERS_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTANCES_DIR="${EXPORTERS_DIR}/instances"

usage() {
    echo "usage: exporter <dataset> [export options...]" >&2
    echo "       exporter all [--force] [--publish] [--dry-run] [--base-url <url>] [--only <slug>[,<slug>...]]" >&2
    echo "" >&2
    echo "available datasets:" >&2
    for d in "$EXPORTERS_DIR"/*/; do
        [ -f "${d}package.json" ] && echo "  $(basename "$d")" >&2
    done
    echo "  all    (reserved) batch: re-export every scripts/exporters/instances/*.json in one run" >&2
    exit 64
}

MODE="${1:-}"
[ -n "$MODE" ] || usage
shift

# =============================================================================
# `all` — batch: iterate every instances/*.json and run its exporter.
# =============================================================================
if [ "$MODE" = "all" ]; then
    ALL_FORCE=0
    ALL_PUBLISH=0
    ALL_DRY_RUN=0
    ALL_BASE_URL=""
    ALL_ONLY=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --force) ALL_FORCE=1; shift ;;
            --publish) ALL_PUBLISH=1; shift ;;
            --dry-run) ALL_DRY_RUN=1; shift ;;
            --base-url)
                [ $# -ge 2 ] || { echo "error: --base-url needs a value" >&2; exit 64; }
                ALL_BASE_URL="$2"; shift 2 ;;
            --only)
                [ $# -ge 2 ] || { echo "error: --only needs a value" >&2; exit 64; }
                ALL_ONLY="$2"; shift 2 ;;
            *) echo "error: unknown option for 'all': $1" >&2; usage ;;
        esac
    done

    PLAN_FILE="$(mktemp)"
    RESULTS_FILE=""
    trap 'rm -f "$PLAN_FILE" "$RESULTS_FILE"' EXIT

    # The plan builder validates every instance file and refuses the whole
    # batch — nothing runs — if any file has an unknown "kind" or a
    # "standalone" file with no "exporter" field, naming the file. It needs
    # no node_modules and no database, so `--dry-run` works from a bare
    # checkout (see the CI step in continuous-integration.yml).
    if ! node "${INSTANCES_DIR}/plan.mjs" "$INSTANCES_DIR" "$ALL_ONLY" > "$PLAN_FILE"; then
        exit 1
    fi

    TAB="$(printf '\t')"

    echo "=================================================================="
    echo "EXPORTER BATCH PLAN"
    echo "=================================================================="
    printf '%-28s %-16s %-28s %s\n' "instance" "exporter" "args" "package"
    while IFS="$TAB" read -r slug exporterDir argsCsv packageName kind; do
        [ -n "$slug" ] || continue
        DISPLAY_ARGS=""
        [ "$argsCsv" != "-" ] && DISPLAY_ARGS=$(echo "$argsCsv" | tr ',' ' ')
        printf '%-28s %-16s %-28s %s\n' "$slug" "$exporterDir" "$DISPLAY_ARGS" "$packageName"
    done < "$PLAN_FILE"
    echo "=================================================================="

    if [ "$ALL_DRY_RUN" = "1" ]; then
        echo "==> dry run: nothing exported, nothing installed"
        exit 0
    fi

    # One preflight for the whole batch, not one per instance: a dead npm
    # session should stop the batch before the first export rather than
    # surfacing seven times at the end (see #1867).
    if [ "$ALL_PUBLISH" = "1" ]; then
        echo ""
        echo "==> npm whoami (publish preflight for the whole batch)"
        WHOAMI_USER="$(npm whoami 2>/dev/null || true)"
        if [ -z "$WHOAMI_USER" ]; then
            echo "error: npm session is not authenticated (npm whoami failed)." >&2
            echo "       Run 'npm login' on the host (Windows: set \$env:HOME = \$env:USERPROFILE first, so the" >&2
            echo "       container mounts the host's ~/.npmrc), then retry — see any exporter's NPM_PUBLISH.md." >&2
            exit 1
        fi
        echo "  npm session: logged in as ${WHOAMI_USER}"
    fi

    RESULTS_FILE="$(mktemp)"
    : > "$RESULTS_FILE"
    BATCH_FAILED=0

    while IFS="$TAB" read -r slug exporterDir argsCsv packageName kind; do
        [ -n "$slug" ] || continue

        echo ""
        echo "=================================================================="
        echo "==> ${slug} (${exporterDir})"
        echo "=================================================================="

        TARGET="${EXPORTERS_DIR}/${exporterDir}"
        if [ ! -f "${TARGET}/package.json" ]; then
            echo "error: no exporter named '${exporterDir}' (from instance '${slug}')" >&2
            printf '%s\t%s\t%s\t%s\t%s\n' "$slug" "$exporterDir" "failed: no such exporter" "-" "$packageName" >> "$RESULTS_FILE"
            BATCH_FAILED=1
            continue
        fi

        RUN_ARGS=""
        if [ "$argsCsv" != "-" ]; then
            OLDIFS="$IFS"
            IFS=','
            for a in $argsCsv; do
                RUN_ARGS="${RUN_ARGS} ${a}"
            done
            IFS="$OLDIFS"
        fi
        [ "$ALL_FORCE" = "1" ] && RUN_ARGS="${RUN_ARGS} --force"
        [ "$ALL_PUBLISH" = "1" ] && RUN_ARGS="${RUN_ARGS} --publish"
        [ -n "$ALL_BASE_URL" ] && RUN_ARGS="${RUN_ARGS} --base-url ${ALL_BASE_URL}"

        # A subshell, checked by `if !`, so one instance's failure is
        # captured here instead of aborting the whole batch (`set -e` is in
        # effect for the script as a whole) — every remaining instance still
        # gets a turn.
        if ! (
            cd "$TARGET"
            # node_modules is a named volume, not the host directory: esbuild
            # (via tsx) ships a platform-specific binary, and the tree
            # installed on a Windows host is unusable here. Empty on first
            # run, so install into it once — same as the single-dataset path
            # below.
            if [ ! -x node_modules/.bin/tsx ]; then
                echo "==> installing ${exporterDir} exporter dependencies (first run only)"
                npm ci --no-fund --no-audit
            fi
            echo "==> exporting ${slug} via ${exporterDir} from ${DB_HOST:-localhost}/${DB_DATABASE:-inventory}"
            npm run export -- $RUN_ARGS
        ); then
            echo "!!! ${slug} FAILED" >&2
            printf '%s\t%s\t%s\t%s\t%s\n' "$slug" "$exporterDir" "failed" "-" "$packageName" >> "$RESULTS_FILE"
            BATCH_FAILED=1
            continue
        fi

        PUB_VERSION="-"
        if [ "$ALL_PUBLISH" = "1" ]; then
            PUB_VERSION=$(node -e "
                try {
                    const pkg = require('${TARGET}/output/${slug}/package.json');
                    process.stdout.write(pkg.version || '-');
                } catch (e) {
                    process.stdout.write('-');
                }
            ")
        fi
        printf '%s\t%s\t%s\t%s\t%s\n' "$slug" "$exporterDir" "ok" "$PUB_VERSION" "$packageName" >> "$RESULTS_FILE"
    done < "$PLAN_FILE"

    echo ""
    echo "=================================================================="
    echo "EXPORTER BATCH SUMMARY"
    echo "=================================================================="
    printf '%-28s %-16s %-24s %s\n' "instance" "exporter" "result" "published version"
    while IFS="$TAB" read -r slug exporterDir result version packageName; do
        [ -n "$slug" ] || continue
        printf '%-28s %-16s %-24s %s\n' "$slug" "$exporterDir" "$result" "$version"
    done < "$RESULTS_FILE"
    echo "=================================================================="

    if [ "$ALL_PUBLISH" = "1" ]; then
        EXPECT_ARGS=""
        while IFS="$TAB" read -r slug exporterDir result version packageName; do
            [ -n "$slug" ] || continue
            if [ "$result" = "ok" ] && [ "$version" != "-" ]; then
                SHORT_NAME="${packageName#@museumwnf/}"
                EXPECT_ARGS="${EXPECT_ARGS} --expect ${SHORT_NAME}@${version}"
            fi
        done < "$RESULTS_FILE"

        if [ -n "$EXPECT_ARGS" ]; then
            echo ""
            echo "==> paste into a viewer-workflows checkout to propagate:"
            echo "node tools/propagate.mjs${EXPECT_ARGS}"
        fi
    fi

    if [ "$BATCH_FAILED" != "0" ]; then
        echo "" >&2
        echo "error: one or more instances failed — see the summary above." >&2
        exit 1
    fi

    exit 0
fi

# =============================================================================
# Single dataset — unchanged behaviour.
# =============================================================================
DATASET="$MODE"

TARGET="${EXPORTERS_DIR}/${DATASET}"
if [ ! -f "${TARGET}/package.json" ]; then
    echo "error: no exporter named '${DATASET}'" >&2
    usage
fi

cd "$TARGET"

# node_modules is a named volume, not the host directory: esbuild (via tsx)
# ships a platform-specific binary, and the tree installed on a Windows host is
# unusable here. Empty on first run, so install into it once.
if [ ! -x node_modules/.bin/tsx ]; then
    echo "==> installing ${DATASET} exporter dependencies (first run only)"
    npm ci --no-fund --no-audit
fi

echo "==> exporting ${DATASET} from ${DB_HOST:-localhost}/${DB_DATABASE:-inventory}"
exec npm run export -- "$@"
