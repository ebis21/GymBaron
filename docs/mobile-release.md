# GYMBARON — mobile release checklist

This repository is configured as a portrait, phone-first Capacitor app with the
bundle/application id `com.ironempire.gym`. Treat that id as immutable after the
first public release.

## Prerequisites

- Node.js 22 or newer (`.nvmrc` is provided).
- iOS: Xcode 26 or newer, an Apple Developer team and an App Store Connect app.
- Android: JDK 21, Android SDK Platform 36, Build Tools 35.0.0 or newer, and a
  Google Play Console app with Play App Signing enabled.

Apple's current upload baseline is Xcode 26 with the iOS 26 SDK. Google Play
requires new apps and updates to target Android 16 / API 36 from 31 August
2026. The project already targets API 36.

## Reproducible preflight

Run from the repository root before every native archive:

```bash
npm ci
npm run typecheck
npm test
npm run mobile:sync
```

`dist/`, `ios/App/App/public/` and Android's generated web assets are ignored,
so a native archive made without the sync step can silently contain stale UI.

## Icons and splash screens

Both are generated from `public/assets/icon.svg` and committed, so a normal
release needs neither step — run them only after the mark itself changes:

```bash
npm run icons      # every app icon, web through Android adaptive
npm run splash     # both platforms' splash screens
```

Never hand-edit the PNGs. They were once made from a painting scaled up past
its own resolution, whose background noise defeated PNG's row filters badly
enough that thirteen splash screens weighed 16MB; drawn as vector on a clean
gradient the same set is under 800KB.

## iOS / App Store

1. Open `ios/App/App.xcodeproj` in Xcode.
2. Select the `App` target and choose the correct Development Team. Do not
   commit a personal team id unless the project has one shared organisation.
3. Increment `CURRENT_PROJECT_VERSION` for every upload and update
   `MARKETING_VERSION` for public releases.
4. Archive the `Release` configuration for a generic iOS device.
5. In Organizer, run Validate App and inspect the generated privacy report.
   `PrivacyInfo.xcprivacy` declares Preferences/UserDefaults reason `CA92.1`.
6. Confirm App Store Connect privacy answers match the shipped native binary:
   no account, ads, tracking or analytics; save/preferences remain on device.
7. Supply iPhone screenshots, age rating, support URL and the public privacy URL
   `https://gymbaron.com/privacy.html`.

The target is intentionally iPhone-only. Re-enable iPad only together with
landscape/window-resizing QA and iPad store artwork.

## Android / Google Play

After installing the Android toolchain:

```bash
npm run mobile:android
./android/gradlew -p android :app:testDebugUnitTest
./android/gradlew -p android :app:lintRelease --warning-mode all
./android/gradlew -p android :app:assembleDebug
./android/gradlew -p android :app:bundleRelease
```

Create an upload key in Android Studio's **Generate Signed Bundle / APK** flow,
store it outside the repository and let Play App Signing hold the distribution
key. Never commit `.jks`, `.keystore`, passwords or `keystore.properties`.
Increment `versionCode` for every upload and update `versionName` as needed.

Before production rollout, test the signed bundle on API 24 and API 36, gesture
and three-button navigation, a display cutout, background/resume, process death,
offline launch, hardware/predictive Back, and a low-memory device. Inspect the
final AAB in Play Console for 16 KB page-size compatibility.

## Store-owned inputs (not kept in Git)

- Apple Development Team, certificates and provisioning profile.
- Android upload keystore and passwords.
- Store descriptions, screenshots, age/content rating and review notes.
- A working `privacy@gymbaron.com` mailbox and deployed privacy page.
- Final legal publisher name, support URL and regional availability.

These values belong to the publisher accounts; source code cannot safely invent
or commit them.
