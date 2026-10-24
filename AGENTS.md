# Delivery requirements

Every visual feature or visible behavior change must include a recording of the real native demo, embedded in its English and Portuguese documentation. This is a user requirement, not an optional follow-up. Do not mark the feature complete, close its issue or prepare its release while the recording is missing or outdated.

Use real native playback and actual interaction where relevant. Inspect the recording, confirm the effect is visible and the file plays, and describe the platform and any limits in the caption. Tests and screenshots do not replace a video. Do not manufacture footage or present a simulator recording as a physical-device recording.

Include the demonstration directly in each visual feature or behavior-change PR description as a playable video attachment, with a platform label and a short explanation of what it shows. Links to repository video files alone are not enough. Reuse the reviewed documentation recordings when they demonstrate the PR, and verify the published description contains the players before handing it over for review. `gh pr create/edit --attach` can upload the local MP4 files.

Run `npm run docs:check-media` and `npm run docs:build`. See `CONTRIBUTING.md` for the capture workflow. Preserve existing media unless replacing it with a reviewed recording of the same behavior.
