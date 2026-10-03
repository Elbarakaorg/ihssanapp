# Care directory: data sources and rules

## Sources

| What | Source | Stored in our database? |
| --- | --- | --- |
| Pharmacy and clinic locations, hours, phone | Google Places API (New) | **Only `google_place_id`** (see terms below) |
| Pharmacy on-duty status (day guard, night guard) | Hirassa API | Guard shifts only, once terms are known |
| Doctors without their own clinic | Doctors register in the app | Yes: `clinician_practice_locations` |
| Hand-entered listings and test data | Admin / SQL | Yes: `care_providers` |

## Google Places: what the terms allow

Google Maps Platform terms restrict copying and caching Places content. In practice:
- You **may store `place_id` indefinitely**. Everything else (names, addresses, phones, hours, ratings, photos) must be fetched live, or cached only briefly. Latitude/longitude may be cached for up to 30 days.
- Place content must be shown on a Google map or with Google attribution. Our map screen does this.
- Do not bulk-download or scrape the Places database to build our own provider list.

Re-check the current Google Maps Platform Service Specific Terms before launch; they change.

### Design

1. A small server endpoint in `services/api` (for example `GET /v1/places/nearby?lat=&lng=&kind=pharmacy`) calls Places API (New) Nearby/Text Search with a **server-side key** and a field mask that asks only for what is shown. The key never ships to the app.
2. The endpoint needs per-user rate limiting and a short response cache (seconds to minutes) to control cost.
3. The app shows Google results and our verified doctors on the same map. Rows are matched by `google_place_id`.
4. Use a different Google key for the server (restricted by server IP, Places API only) than for the map (referrer-restricted).

Status: **not built yet.** It needs the server key and a billing budget alert in Google Cloud.

## Hirassa (pharmacy guard schedule)

Status: **blocked.** We have a contact but no documentation. Before any code, get from Hirassa in writing:
- Authentication method and a sandbox key
- Endpoints and response format; how pharmacies are identified (name, address, coordinates, or an ID we can match to a Google `place_id`)
- Which guard types are returned (day, night, 24h, holiday) and the date range available
- Rate limits and pricing
- **Whether we may store and redisplay their data**, and any attribution they require
- Uptime and support contacts

Planned design once known: a server-side adapter fetches shifts on a schedule, stores only what the terms allow in a `pharmacy_guard_shifts` table (pharmacy `google_place_id`, shift type, start/end, fetched_at), and the app shows an "On duty tonight" filter and badge. Rows are written by the server only; the app only reads. Display a "last updated" time and a disclaimer to call the pharmacy first, since guard information can be wrong.

## Doctors without their own clinic

Implemented in migration `202610030002_clinician_practice_locations.sql`.

- A clinician (already registered in `clinician_verifications`) adds one or more **practice locations**: a clinic, a hospital, or a private office, with city, coordinates, specialty, consultation modes (in person, video) and schedule.
- New locations start as `pending`. The Ihssan team (permission `providers.verify`) approves them. Editing a location sends it back to `pending`; doctors cannot approve themselves.
- A location can only be verified if the doctor is verified. If a doctor stops being verified, all their locations are automatically retired.
- Only `verified` locations are publicly readable.

Still to build: the doctor-facing screen to add and manage locations, the admin review screen, and showing these locations as pins on the map (the map currently reads `care_providers` only).

## Open questions for the product owner

- Who verifies a doctor's license in practice (Conseil de l'Ordre check)? No process or function exists yet.
- Is "video consultation" only a label, or will the app host calls and payments? Booking and payments are separate phases in the implementation plan.
- Is Hirassa a paid partnership, and does it allow caching?
