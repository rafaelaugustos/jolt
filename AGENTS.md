# Delivery requirements

Every visual feature or visible behavior change must include a recording of the real native demo, embedded in its English and Portuguese documentation. This is a user requirement, not an optional follow-up. Do not mark the feature complete, close its issue or prepare its release while the recording is missing or outdated.

Use real native playback and actual interaction where relevant. Inspect the recording, confirm the effect is visible and the file plays, and describe the platform and any limits in the caption. Tests and screenshots do not replace a video. Do not manufacture footage or present a simulator recording as a physical-device recording.

Run `npm run docs:check-media` and `npm run docs:build`. See `CONTRIBUTING.md` for the capture workflow. Preserve existing media unless replacing it with a reviewed recording of the same behavior.
