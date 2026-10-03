# Care directory: data sources and rules

## Sources

| What | Source | Stored by us |
| --- | --- | --- |
| Pharmacies, clinics, hospitals (names, addresses, phones, coordinates) | Google Places API (New), via the Ihssan API | Nothing, except `google_place_id` and the doctor's own chosen location |
| Directions | Google Maps link (`google.com/maps/dir`) opened from the card | Nothing |
| Which pharmacies are on duty (day, night, 24h) | Hirassa API, via the Ihssan API | Nothing (short in-memory cache only) |
| Doctors without their own clinic | Doctors register in the app and pick their clinic/hospital from Google search | `clinician_practice_locations` |

Google opening hours are deliberately **not** requested or shown: they are unreliable for guard duty. Only Hirassa decides "on duty".

## Flow

- `GET /v1/care/nearby?lat&lng&radius&kind` (auth required) calls Google Places, then asks Hirassa for each distinct city in the results, matches guard pharmacies to Google places, and returns `guard: day | night | 24h | null` plus `guardStatus: live | unavailable | not_applicable`.
- Matching: by coordinates within 150 m when Hirassa provides them, otherwise by exact normalised name within the same city. Ambiguous names are not matched, so a pharmacy is never wrongly shown as on duty.
- If Hirassa fails or is not configured, `guardStatus` is `unavailable` and the app says so. It never guesses.
- `GET /v1/care/search?q=` lets a doctor find their clinic or hospital (health-related places only).
- Safeguards: per-user rate limit (30/min), short in-memory caches (places 2 min, search 5 min, guard 10 min), strict input validation, Google key kept server-side with a minimal field mask.

## Google terms

Google restricts storing Places content. We store only `google_place_id` for our own listings, plus the venue name, address and coordinates the doctor confirmed for their own profile (needed to show a doctor's pin). Re-check the current Google Maps Platform terms before launch, and consider refreshing those fields from the place id periodically. Content must appear on a Google map (it does).

## Hirassa (needs documentation)

We have a contact but no documentation. `services/api/src/guard.ts` contains the adapter. Its response parser (`parseHirassaGuards`) is an **assumption** (array or `{data: [...]}`, with fields like `name`, `type`, `lat`, `lng`, `city`). Configure `HIRASSA_GUARDS_URL` (HTTPS, with `{city}`), `HIRASSA_API_KEY`, `HIRASSA_AUTH_HEADER`, then adjust the parser to the real format. Ask Hirassa for: auth method, endpoints and format, how pharmacies are identified, guard types and date range, rate limits and price, and whether we may cache and redisplay their data.

## Doctors without their own clinic

- A registered clinician searches Google for their clinic or hospital in **Menu > My practice locations** and adds it with specialty, hours and video option.
- New or edited locations are `pending`; only the Ihssan team (`providers.verify`) can approve. Doctors cannot self-approve. The public doctor name comes from the verified registration, not from client input.
- Only `verified` locations are public, and they disappear automatically if the doctor stops being verified.
- Approved locations show as doctor pins on the map.

Still to build: the admin portal screen for reviewing practice locations (until then, approve them in the Supabase table editor).

## Open questions for the product owner

- Who verifies a doctor's license in practice (Conseil de l'Ordre check)? No process or function exists yet.
- Is "video consultation" only a label, or will the app host calls and payments? Booking and payments are separate phases in the implementation plan.
- Is Hirassa a paid partnership, and does it allow caching?
