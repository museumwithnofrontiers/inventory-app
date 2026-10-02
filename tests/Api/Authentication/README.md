# API Authentication Tests

The mobile token endpoints (`/api/mobile/*`) and the bearer tokens they issue: acquiring a token, the two-factor step (TOTP and recovery codes), the two-factor status lookup, wiping a device's tokens, and using a token on `/api/user`.

The admin panel's own login, two-factor and password-reset pages are tested under `tests/Filament/Pages`.
