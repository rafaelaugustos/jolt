# Delivery requirements

Every visual feature or visible behavior change must include a recording of the real native demo, embedded in its English and Portuguese documentation. This is a user requirement, not an optional follow-up. Do not mark the feature complete, close its issue or prepare its release while the recording is missing or outdated.

Use real native playback and actual interaction where relevant. Inspect the recording, confirm the effect is visible and the file plays, and describe the platform and any limits in the caption. Tests and screenshots do not replace a video. Do not manufacture footage or present a simulator recording as a physical-device recording.

Include the demonstration directly in each visual feature or behavior-change PR description as a playable video attachment, with a platform label and a short explanation of what it shows. Links to repository video files alone are not enough. Reuse the reviewed documentation recordings when they demonstrate the PR, and verify the published description contains the players before handing it over for review. `gh pr create/edit --attach` can upload the local MP4 files.

PR descriptions use English-language recordings only. Do not record or attach Portuguese versions for a PR; reuse the reviewed English recordings. This preference applies to future PRs; leave existing PR attachments as they are unless asked to change them. Documentation still needs coverage in both English and Portuguese.

Documentation MP4s are published to R2 with `npm run media:upload`, never committed under `docs/public/`. Run `npm run docs:check-media`, `npm run media:verify` and `npm run docs:build`. See `CONTRIBUTING.md` for the capture and publishing workflow. Preserve existing media unless replacing it with a reviewed recording of the same behavior.

# Mavis adoption follow-ups

Whenever Jolt gains a new Web capability, inspect the current implementation and open/closed issues in `getcortexlabs/mavis-ui`. Create or update the Mavis adoption issues that are actually needed, avoiding duplicates. Link the relevant Jolt issues/PR and state whether the capability is merged, published or still pending, with explicit dependencies and acceptance criteria. Check the impact on shared application code, component behavior and lifecycle. Keep Mavis implementation in its own workstream unless the user asks otherwise. This is a standing user requirement.

# Mobile and Web delivery

Whenever a capability is delivered for mobile, deliver its feasible Web equivalent as part of the same feature work. This is a standing user requirement. Plan by capability across platforms rather than alternating unrelated native-only and Web-only batches. Review the existing Web implementation first: reuse working equivalents and extend only the missing contract instead of creating duplicate APIs.

Share platform-independent definitions, recipes and lifecycle semantics where possible; keep platform execution in adapters. Document supported properties, units, accessibility, interruption, cancellation, disposal and platform limits. Do not promise identical pixels, native threading, hardware access or performance where browser capabilities differ. For genuinely platform-specific behavior, record the concrete reason and any useful fallback; a native implementation alone does not establish Web support.

Include native and Web acceptance evidence in the owning issue and delivery plan. Implementation may use linked PRs, but keep a portable feature's overall status pending until both feasible backends are validated. Apply the recording requirements above and include reviewed browser recordings for new visible Web behavior. For native bug fixes, check the equivalent Web behavior when applicable without inventing a browser defect or forcing an irrelevant port. Track existing published native-only gaps explicitly without rewriting their release history. Apply the Mavis adoption follow-up requirement whenever the Web capability lands.
