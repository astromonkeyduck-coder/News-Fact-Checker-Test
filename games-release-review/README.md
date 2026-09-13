# Noteworthy Games checkpoint

Saved at the user’s request to pause. See [STATUS.md](STATUS.md) for completed gameplay, measured validation and the remaining release gates. This is not a production release.

Open the running preview at http://127.0.0.1:4173/games/ . The active preview serves `/private/tmp/noteworthy-publication-release`.

`implementation/` durably preserves Games source, bundled data, tests, screenshots, documentation, legacy route aliases and build integration. `manifest.json` records SHA-256 hashes and the current checkout baseline. `checkpoint.patch` contains textual differences against that baseline; binary screenshots and geometry assets are preserved in the implementation directory. Existing source files were not changed by packaging.

To reconstruct in a new isolated directory, run:

```sh
python3 /Users/richarda/breaking-news-game/games-release-review/materialize.py --source /Users/richarda/breaking-news-game --destination /private/tmp/noteworthy-games-resumed
cd /private/tmp/noteworthy-games-resumed
npm run games:test
npm run publication:build
npm run publication:preview
```

The destination must not exist. The materializer checks hashes and refuses a changed baseline, copies the source and overlays the checkpoint without editing the source. If port 4173 is already serving this preview, reuse it rather than starting a conflicting server. Browser progress is local to the browser origin; export a copy from Journal before changing origin or clearing storage.

The final checkpoint passed 116 Games tests, 126 publication tests, and the publication/Games build. Manifest integrity and a dry-run patch application were checked. Full reconstruction and remaining acceptance tests are for the resumed release pass.
