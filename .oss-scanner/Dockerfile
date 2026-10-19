# Build image for Anthropic's OSS Scanner (https://github.com/anthropics/oss-scanner).
#
# The scanner builds this file with the repository root as the build context and no --target, then audits the
# result with no network access, so everything the app, its tests and its importer need is fetched here.
#
#   /src                     the checkout: the Laravel 12 + Filament 3 app, built and ready (vendor/, public/build/)
#   /src/database/scan.sqlite a migrated, seeded database the running app uses (the test suite keeps its own
#                            sqlite :memory: database, as phpunit.xml forces)
#   /src/scripts/importer    the data importer, with its node_modules installed
#
# `inventory-start` serves the app on http://127.0.0.1:8000/ (/ redirects to the Filament panel at /admin).
# Seeded accounts (APP_ENV=local, LocalUserSeeder):
#   user@example.com  / password   role "Regular User"     (data operations, panel access)
#   admin@example.com / password   role "Manager of Users"  (user and role management only)
#
# The build context is filtered by .oss-scanner/Dockerfile.dockerignore, not the root .dockerignore (which is for
# production images and leaves out .env.local.example, tests/ and phpunit.xml).
#
# Kept in step with .docker/Dockerfile: same PHP minor (CI's php-version-drift job pins it), same extension list.
FROM php:8.5-cli-trixie

ENV DEBIAN_FRONTEND=noninteractive \
    COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_NO_INTERACTION=1 \
    COMPOSER_MEMORY_LIMIT=-1

ADD --chmod=0755 \
    https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions \
    /usr/local/bin/

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git unzip curl procps sqlite3 \
    && install-php-extensions pdo_mysql pdo_sqlite bcmath intl gd zip pcntl sockets opcache exif redis \
    && rm -rf /var/lib/apt/lists/* /tmp/pear
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# package.json requires Node >= 24.11.
COPY --from=node:24-trixie-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:24-trixie-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version && npm --version

# Errors are logged, not shown, as in production.
RUN { echo 'memory_limit=512M'; \
      echo 'error_reporting=E_ALL'; \
      echo 'display_errors=Off'; \
      echo 'log_errors=On'; \
      echo 'error_log=/dev/stderr'; \
      echo 'opcache.validate_timestamps=1'; \
      echo 'opcache.revalidate_freq=0'; \
    } > /usr/local/etc/php/conf.d/oss-scanner.ini

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

# Dependencies with dev tools (PHPUnit, Pest) so the suite runs offline, then the Filament theme / Vite assets.
RUN mkdir -p bootstrap/cache storage/app/public storage/framework/views storage/framework/cache/data \
             storage/framework/sessions storage/logs \
    && cp .env.local.example .env \
    && composer install --no-progress --prefer-dist \
    && npm ci --no-fund --no-audit \
    && npm run build \
    && (cd scripts/importer && npm ci --no-fund --no-audit)

# A runnable local site on a sqlite file, with a fresh key (the one in .env.local.example is a shared example).
# MinimalDatabaseSeeder runs UserSeeder, which runs LocalUserSeeder when APP_ENV=local.
RUN sed -i 's#^DB_DATABASE=.*#DB_DATABASE=/src/database/scan.sqlite#' .env \
    && touch database/scan.sqlite \
    && php artisan key:generate --force \
    && php artisan migrate --force --seed --seeder='Database\Seeders\MinimalDatabaseSeeder' \
    && php artisan storage:link

# "[a]rtisan serve" matches the server but not a shell whose own command line contains the pattern.
RUN printf '%s\n' '#!/bin/sh' 'cd /src' \
      'pgrep -f "[a]rtisan serve" >/dev/null || (php artisan serve --host=127.0.0.1 --port=8000 >/tmp/inventory-serve.log 2>&1 &)' \
      'i=0; until curl -sS -o /dev/null http://127.0.0.1:8000/admin/login 2>/dev/null; do' \
      '  i=$((i+1)); [ "$i" -le 120 ] || { echo "inventory-start: no answer on :8000 after 60s, see /tmp/inventory-serve.log" >&2; exit 1; }' \
      '  sleep 0.5' \
      'done' \
      > /usr/local/bin/inventory-start \
    && chmod +x /usr/local/bin/inventory-start

# Smoke-test the site and run the fast test suites, without letting a failing test abort the build.
RUN set -e; inventory-start; \
    curl -fsS -o /dev/null http://127.0.0.1:8000/admin/login; \
    php artisan test --testsuite=Unit --no-ansi || echo "WARNING: Unit tests reported failures"; \
    php artisan test --testsuite=Api --no-ansi --parallel || echo "WARNING: Api tests reported failures"; \
    pkill -f "[a]rtisan serve" || true

# Keep build products out of the checkout's `git status`.
RUN printf '.env\ndatabase/scan.sqlite\n' >> /src/.git/info/exclude 2>/dev/null || true
