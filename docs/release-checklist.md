# Final release checklist

This is the authoritative human sign-off for Placeholder Manager V1. Automated gates are necessary but not sufficient: the exact staged artifact must also be exercised in real Obsidian desktop and Android environments before a public GitHub release or Community directory submission.

## 1. Freeze release identity

- [ ] Choose the public release version. Do not bump `manifest.json`, `package.json`, or `versions.json` until the candidate has passed the earlier checklist sections.
- [ ] Confirm `manifest.id` remains `placeholder-manager` and the install folder uses that exact name.
- [ ] Recheck the Obsidian Community registry for both the ID `placeholder-manager` and name `Placeholder Manager` immediately before publishing.
- [ ] Confirm `minAppVersion` represents the oldest Obsidian version actually tested and supported.
- [ ] After the version bump, verify `manifest.json`, `package.json`, `versions.json`, and the future Git tag all use the exact same plugin version where applicable.

As of **2026-09-20**, the Community registry contains neither the current ID nor name. Public Obsidian is 1.13.7 on Desktop and 1.13.8 on Mobile; 1.14.2 is Catalyst/early access. Recheck these facts on the day of release instead of treating this record as permanent.

## 2. Lock dependency resolution

- [ ] Use Node 22 and the repository's normal npm client in a networked environment.
- [ ] Run `npm install --no-audit --no-fund` once to generate a genuine `package-lock.json`.
- [ ] Review the lockfile diff and commit it. Never hand-author or synthesize a lockfile.
- [ ] Run `npm run check:lockfile`.
- [ ] Delete `node_modules` and run `npm ci --no-audit --no-fund` from the committed lockfile.
- [ ] Confirm CI uses `npm ci`, not floating `npm install` resolution.

## 3. Run the authoritative automated gate

From a clean checkout with dependencies installed through the committed lockfile:

```bash
npm ci --no-audit --no-fund
npm run release:check
```

All gates must pass in one uninterrupted run. Do not substitute individually green commands for a failed aggregate run.

The aggregate run must cover lockfile validation, exact local dependency preflight, release metadata, validator self-tests, TypeScript, ESLint with zero warnings, subsystem boundaries, readability/API names, architecture synchronization, mobile compatibility, Community source self-review, unit/property/integration tests, performance budgets, a fresh production bundle, bundle smoke tests, and final asset validation.

## 4. Stage and freeze the exact artifact

After `npm run release:check` succeeds:

```bash
npm run release:stage
```

- [ ] Confirm `dist/placeholder-manager/` contains exactly `main.js`, `manifest.json`, and `styles.css`.
- [ ] Confirm `dist/release-manifest.json` records SHA-256 hashes for those exact files.
- [ ] Do not edit or rebuild the three staged files between smoke testing and publishing.
- [ ] If any source, dependency, version, or staged runtime file changes, discard the staged artifact and restart from Section 3.

## 5. Fresh-install desktop smoke

Use a disposable vault and install **only** the three staged files from `dist/placeholder-manager/`.

- [ ] Test the declared minimum supported Desktop version.
- [ ] Test the current public Desktop version if it differs from the minimum.
- [ ] Plugin enables without console errors.
- [ ] Insert, edit, resolve, and delete a placeholder.
- [ ] Next/Previous navigation wraps and does not repeat the same selected token.
- [ ] Current file, Project, and Vault sidebar scopes return expected records.
- [ ] Search, type filters, Unknown types, and mobile-independent pagination behavior work.
- [ ] Reading View chips can be enabled/disabled and restored without damaging Markdown.
- [ ] Custom type creation, display-name change, color change, and deletion behave as documented.
- [ ] Manual rebuild completes and accurately reports any unavailable files.
- [ ] Disable/re-enable and reload the plugin; verify no duplicate views/listeners remain.
- [ ] Restart Obsidian and verify settings/index/UI reconstruct cleanly.

Record Desktop OS, Obsidian version, vault size, and console findings in the release evidence.

## 6. Upgrade and migration smoke

Test against real settings created by a prior V0.1.x build rather than a hand-written approximation.

- [ ] Install the prior build and create custom types, project property, and Reading View preference.
- [ ] Replace only the runtime files with the staged candidate.
- [ ] Confirm schema-0 settings migrate once to the schema-1 envelope and retain user-visible values.
- [ ] Confirm existing placeholder Markdown remains untouched.
- [ ] Confirm removed/unknown custom type IDs remain visible as Unknown rather than becoming General.
- [ ] Restart Obsidian after migration and verify the migrated data remains stable.
- [ ] Keep a backup of the pre-upgrade `data.json` with the private release evidence, not in the public repository.

## 7. Physical Android smoke

Use the exact staged files and complete all items from `docs/mobile-support.md`. At minimum, record:

- [ ] Device model and Android version.
- [ ] Public Obsidian Mobile version.
- [ ] Vault file count and approximate size.
- [ ] Cold-start indexing behavior.
- [ ] Soft-keyboard behavior in insert/edit/resolve modals.
- [ ] Rotation with manager search/filter open.
- [ ] Light/dark theme switching with editor, manager, and Reading View visible.
- [ ] Short suspend/resume active-file reconciliation.
- [ ] Long suspend/resume full reconciliation.
- [ ] ~500k-character note scrolling/editing behavior.
- [ ] Force-stop/eviction/relaunch behavior.
- [ ] Disable/re-enable/reload behavior.
- [ ] Any Chromium remote DevTools long-task or console findings.

A simulated mobile harness does **not** satisfy this section.

## 8. Optional Catalyst forward-compatibility smoke

This is recommended but does not replace minimum/public-version testing.

- [ ] Run the staged artifact on the current Catalyst Desktop release.
- [ ] If available, run it on current Catalyst Mobile.
- [ ] Record any warning or behavior difference without raising `minAppVersion` unless the public build genuinely requires the newer API.

## 9. Community self-review

- [ ] Run `npm run check:community`.
- [ ] Run the official Obsidian ESLint configuration through the full release gate.
- [ ] Review `docs/community-review.md` and resolve every pending or failed item.
- [ ] Confirm README disclosures remain accurate: no network use, accounts, telemetry, ads, payments, or access outside the vault.
- [ ] Confirm LICENSE is present and dependency licenses are acceptable.
- [ ] If the repository is already registered in the Community directory, run **Review branch** against the exact release commit before tagging.

## 10. Version, tag, and GitHub release

Only after Sections 1–9 are signed off:

- [ ] Set the final version in `manifest.json` and `package.json`.
- [ ] Add/update the matching `versions.json` entry.
- [ ] Run `npm ci --no-audit --no-fund && npm run release:check && npm run release:stage` again after the version change.
- [ ] Re-run the shortest artifact sanity smoke from the staged folder; the hashes will differ after a version bump because `manifest.json` changed.
- [ ] Commit the version/lockfile/source/docs state.
- [ ] Create a Git tag that is the exact manifest version with no `v` prefix.
- [ ] Push the tag and allow `.github/workflows/release.yml` to build, gate, stage, and create the GitHub release.
- [ ] Verify the GitHub release contains `main.js`, `manifest.json`, and `styles.css` from the staged payload.
- [ ] Compare downloaded release-file SHA-256 values to the CI staging output before submission.

## 11. Community directory submission

- [ ] Confirm the repository default branch HEAD contains the release manifest, README, LICENSE, lockfile, and source that produced the release.
- [ ] Link the GitHub account to the Obsidian Community profile.
- [ ] Add/claim the plugin through the Community directory.
- [ ] Run the directory review and address all errors before publishing the entry.
- [ ] Treat warnings individually; resolve them when practical rather than assuming warnings are harmless.
- [ ] If review feedback requires code or manifest changes, increment the plugin version and repeat Sections 3–11. Never replace assets under an already published version tag.

## Release invalidation rule

Any change to production source, runtime CSS, manifest metadata, dependency resolution, or generated `main.js` after a successful sign-off invalidates the artifact. Re-run the automated gates, stage a new payload, and repeat the relevant real-device smoke tests before release.
