# Registering and Publishing Ihssan on iOS and Android

A step-by-step guide. Follow the parts in order. Parts 1 and 2 explain the names; they are the part most people find confusing.

---

## Part 1: The three different "names" (read this first)

An app has several names that are **not the same thing**:

| Name | Example | Where it shows | Must be unique? |
| --- | --- | --- | --- |
| **Display name** | `Ihssan` | Under the icon on the phone, and the store title | iOS: yes, inside the App Store. Android: no, not strictly |
| **Bundle ID / package name** | `com.ihssan.app` | Hidden. Identifies the app to the stores and to Google Maps | **Yes, worldwide, per store** |
| **Domain name** | `ihssanapp.com` | Your website | Yes, but it is unrelated to the other two |

### Can the ID be different from the domain?

**Yes.** The reverse-domain format (`com.company.app`) is only a convention. Neither Apple nor Google checks that you own the domain. You can use `com.ihssan.app` even if your website is `ihssanapp.com`.

We use **`com.ihssan.app`** (already set in `apps/mobile/app.json`). It contains no `elbarakaorg`.

Notes:
- The ID uses only letters, numbers and dots. No spaces, no capitals needed, no hyphens on Android.
- Pick it **before the first store upload**. After the app is published the ID can never be changed. Changing it later means publishing a brand new app and losing users and reviews.
- If you later own `ihssan.com`, `com.ihssan.app` matches it. If you do not, it still works.
- The deep-link scheme (`ihssan://`) in `app.json` is separate and can stay.

### How to check if the ID is free

Nobody can reserve an ID in advance by searching a list. Availability is checked at the point of creating the app. Do these checks:

- **Android (quick check):** open `https://play.google.com/store/apps/details?id=com.ihssan.app` in a browser. A "not found" page suggests nobody has published that ID yet. This does not catch unpublished apps in private Play Console accounts. The real check is when you create the app in Play Console and upload the first build; it rejects the package name if it is already taken.
- **iOS:** in Apple Developer, go to **Certificates, Identifiers & Profiles > Identifiers > + > App IDs**. Enter `com.ihssan.app`. If it is already registered by another team, Apple says the identifier is not available.
- **If it is taken:** use `com.ihssan.care`, `com.ihssan.mobile`, or `ma.ihssan.app` (`ma` is Morocco's country code). Then change both values in `apps/mobile/app.json` (`ios.bundleIdentifier` and `android.package`) and in your Google Maps key restrictions.

### The display name

The app name `Ihssan` is the `name` field in `app.json`.
- **App Store:** the store name must be unique across the App Store. When you create the app in App Store Connect, it tells you right away if `Ihssan` is taken. If it is, use `Ihssan: Health & Giving` (the store title can be longer than the name under the icon, up to 30 characters).
- **Google Play:** names do not have to be unique, but copying a well-known brand can get the app rejected. Search "Ihssan" in the Play Store and App Store first, and check existing health or charity apps.
- **Trademark:** also search for the name in your target countries' trademark registers (OMPIC in Morocco). The stores can remove an app after a trademark complaint.

---

## Part 2: Accounts you need

| Account | Cost | Time | Notes |
| --- | --- | --- | --- |
| Expo (EAS) | Free tier | Minutes | Sign up at https://expo.dev. Builds the app in the cloud |
| Apple Developer Program | 99 USD / year | 1 to 7 days | https://developer.apple.com/programs/enroll |
| Google Play Console | 25 USD one time | 1 to 7 days | https://play.google.com/console/signup |

### Individual or organisation?

Ihssan handles health data and donations, so register as an **organisation** if the foundation is a legal entity.
- **Apple:** an organisation needs a **D-U-N-S number** (free, from https://developer.apple.com/enroll/duns-lookup/, takes days to weeks) and a legal entity name and website. The seller name shown on the store is the legal name.
- **Google:** organisation accounts need a D-U-N-S number as well. **Personal accounts created after Nov 2023** must run a closed test with at least 12 testers for 14 days before they can go live. Organisation accounts are exempt. This is a strong reason to use an organisation account.
- Use an email that belongs to the organisation, not a personal address, so you do not lose access if someone leaves.
- Turn on two-factor authentication on all three accounts.

---

## Part 3: One-time project setup

Run these in `apps/mobile`.

```bash
npm install -g eas-cli
eas login
eas init            # links the project to your Expo account and writes extra.eas.projectId
eas build:configure # creates eas.json
```

Edit `eas.json` so it has at least these profiles:

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

### Environment variables for builds

`.env.local` is git-ignored, so EAS does **not** receive it. Create the variables in EAS:

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://<your-project>.supabase.co" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "<publishable key>" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "<web maps key>" --visibility plaintext
eas env:create --environment production --name GOOGLE_MAPS_NATIVE_API_KEY --value "<native maps key>" --visibility sensitive
```

Never put the Supabase `service_role` key anywhere in the app.

---

## Part 4: Android, step by step

1. **Create the Play Console account** (Part 2) and finish identity verification.
2. **Create the app:** Play Console > **Create app**. Set the name, default language, **App** (not game), **Free**, and accept the declarations.
3. **Build the first release:**
   ```bash
   eas build -p android --profile production
   ```
   When EAS asks, let it generate and manage the keystore (signing key). Do not lose access to your Expo account: the key lives there. You can download a backup with `eas credentials`.
4. **Get the SHA-1 fingerprint** for Google Maps: run `eas credentials -p android`, choose the production keystore, and copy the **SHA-1**. Also copy the **Play App Signing** SHA-1 from Play Console > **Setup > App signing** once you upload (Google re-signs the app, so the Play SHA-1 is the one users actually run).
5. **Restrict the native Maps key:** Google Cloud Console > APIs & Services > Credentials > your native key > **Android apps** > add package `com.ihssan.app` with each SHA-1 (EAS and Play). API restriction: **Maps SDK for Android** only.
6. **Upload the first build manually.** Play Console requires the very first upload through the website: **Testing > Internal testing > Create release**, upload the `.aab` file downloaded from your EAS build page.
7. **Fill in the store listing:** short description (80 characters), full description, icon (512x512), feature graphic (1024x500), at least 2 phone screenshots, category **Health & Fitness** (or **Medical** if you give medical advice; pick carefully, Medical has extra review).
8. **Complete the "App content" forms:**
   - **Privacy policy URL** (required, must be a public web page).
   - **Data safety** form: declare health info, personal info (email, name), and photos; say it is encrypted in transit and users can request deletion.
   - **Health apps declaration**, **Ads** (none), **Target audience** (adults), **Content rating** questionnaire.
   - **Account deletion**: provide an in-app path and a web URL.
9. **Test:** add testers by email in the internal testing track and install from the Play link.
10. **Go to production:** Production > Create release > pick the tested build > submit for review (1 to 7 days).
11. **Later releases** can be automated: `eas submit -p android --latest` (needs a Google service account key, see https://docs.expo.dev/submit/android/).

---

## Part 5: iOS, step by step

You do not need a Mac for any of this; EAS builds in the cloud.

1. **Enrol in the Apple Developer Program** (Part 2).
2. **Register the App ID:** developer.apple.com > Certificates, Identifiers & Profiles > Identifiers > **+** > App IDs > App > Bundle ID **Explicit** `com.ihssan.app`. This is also your availability check. (EAS can do this automatically on the first build, but doing it yourself shows any conflict early.)
3. **Create the app record:** https://appstoreconnect.apple.com > **Apps > + > New App**. Platform iOS, name `Ihssan`, language, bundle ID `com.ihssan.app`, SKU (any internal string such as `ihssan-ios-1`). If the name is taken, you get an error here; use a longer name.
4. **Build:**
   ```bash
   eas build -p ios --profile production
   ```
   EAS asks you to sign in with your Apple ID and creates the distribution certificate and provisioning profile for you. Accept the defaults.
5. **Restrict the native Maps key:** in Google Cloud, set the key to **iOS apps** with bundle ID `com.ihssan.app` and API **Maps SDK for iOS**.
6. **Submit to TestFlight:**
   ```bash
   eas submit -p ios --latest
   ```
   Apple processes the build (10 to 30 minutes). Then in App Store Connect > **TestFlight**, add internal testers (members of your team) and external testers (needs a short Beta App Review).
7. **App Store listing:** subtitle, description, keywords, support URL, **privacy policy URL**, screenshots (6.9-inch and 6.5-inch iPhone sizes are required), category **Health & Fitness** or **Medical**, age rating questionnaire.
8. **Privacy:** fill in **App Privacy** ("nutrition labels"): health and fitness data, contact info, user content (photos), identifiers; mark whether each is linked to the user. Add the privacy policy.
9. **Apple rules that apply to Ihssan:**
   - **In-app account deletion** is mandatory if users can create accounts (Guideline 5.1.1(v)). Check that the app has it before submitting.
   - **Sign in with Apple** is required if you offer Google sign-in as a third-party login (Guideline 4.8). Either add Sign in with Apple or confirm you meet the privacy-focused alternative exceptions.
   - **Health data** (Guideline 5.1.3): do not use it for ads, and be clear about how it is shared with clinicians.
   - **Donations** (Guideline 3.2.1(vi)): donations to registered non-profits can be done outside Apple's purchase system only when the charity is approved and eligible. The app currently has no in-app payment, which keeps this simple. Do not link out to payment pages until you have checked this with Apple's rules or a lawyer.
   - **Medical disclaimer:** the app must not present results as a diagnosis; the current wording already avoids this.
   - Remove the "Preview build" banner when you are ready for the public, and make sure no screen is a placeholder.
   - Provide a **demo account** and review notes in App Store Connect so the reviewer can log in and see clinician features.
10. **Submit for review:** select the build, **Add for Review**, then **Submit**. Review usually takes 1 to 3 days. If rejected, read the message in App Store Connect Resolution Center, fix, and resubmit.

---

## Part 6: Release checklist (before pressing "Submit")

- [ ] Bundle ID and package name final (`com.ihssan.app` or your chosen alternative) and identical in `app.json` and in Google key restrictions
- [ ] App name checked in both stores and trademark search done
- [ ] Privacy policy and terms published on a public URL
- [ ] Account deletion works inside the app, with a web URL too
- [ ] Supabase migrations applied on the production project, email confirmation enabled
- [ ] Production env vars created in EAS
- [ ] Both Google Maps keys restricted (web by referrer, native by app ID and SHA-1)
- [ ] Sign in with Apple decision made for iOS
- [ ] Preview banner removed and no placeholder screens
- [ ] Tested on a real iPhone (TestFlight) and a real Android device
- [ ] Screenshots, icon, descriptions in Arabic, French and English prepared
- [ ] Demo reviewer account created
- [ ] Legal and clinical review of health content and donation wording

## Part 7: Updating the app after release

- **JavaScript or content changes only:** `eas update --branch production --message "..."` ships over the air within minutes without a store review. See the `eas-update` skill notes in `.claude/skills/`.
- **Native changes** (new native library, permissions, SDK upgrade): a new build and store submission.
- Version numbers: `version` in `app.json` is user-facing; EAS increments the build number automatically with `autoIncrement`.

## Useful links

- Expo build and submit: https://docs.expo.dev/build/introduction/ and https://docs.expo.dev/submit/introduction/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play policies: https://support.google.com/googleplay/android-developer/answer/9859455
- Google API key restrictions: https://cloud.google.com/docs/authentication/api-keys

## Appendix: Making the care directory show data

The directory has no database of providers. Pharmacies, clinics and hospitals come live from Google Places through the Ihssan API, and pharmacy guard status comes from Hirassa. See `docs/care-directory-data-sources.md`. To see pins:

1. Apply all migrations in `supabase/migrations/`.
2. Create a **server-side** Google key restricted to your API server IP and to **Places API (New)** only, and put it in `services/api/.env.local` as `GOOGLE_PLACES_API_KEY`. Enable billing and a budget alert. Never reuse the app map keys.
3. Run the API (`npm run dev` in `services/api`) and set `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env.local` (HTTPS in production, also in Vercel and EAS).
4. Fill `HIRASSA_GUARDS_URL`, `HIRASSA_API_KEY` and `HIRASSA_AUTH_HEADER` once Hirassa provides them. Without them the map still works and shows a notice that guard information is unavailable.
