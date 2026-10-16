# S2A Pilot Bridge 1.3.4

The rights to S2A Pilot and S2A Pilot Bridge belong to the company S2A Production. These applications were developed by Antoine CLOPIER with assistance from ChatGPT.

[Français](README.md)

Universal macOS app: Intel and Apple Silicon, macOS 13 or later. Uses the system language initially; the Français / English / Español / Deutsch header selector remembers a manual preference. User-authored project titles, Cue names and descriptions are preserved.

## Import and monitor

Bridge automatically detects open QLab workspaces and lets you choose when several are open. Save the workspace before importing. Add multiple project packages to import each show into its own Timeline Group cue. The group retains its number and children use numbers such as 5.1, 5.2 and 5.3, avoiding existing numbers. Existing imports are not renumbered. The monitor follows imported shows and can stay on top.

The monitor shows the next Cue, its visual, countdown and full-width description below. Long descriptions scroll within this area; empty descriptions add no extra space. User descriptions from Pilot remain untranslated.

See the [illustrated manuals](../docs/manual/README.md).

## Validation limits

Chrome tests cover creation, editing, autosave, language selection, user content preservation, PDF preview/export, offline files, waveform zoom and mocked screen detection. Bridge is compiled for both architectures and its local signature is verified. Real Safari/iPad touch behavior, real extended-display playback, live QLab imports and execution on a physical Intel Mac must still be checked before show use.


## Build from source

Run `zsh build.sh` with Xcode command-line tools installed. The script builds both architectures, combines them into a universal app, generates the correct blue/orange icon and signs it locally. No notarization is performed.


## License

Use is permitted; redistribution, publication or hosting for third parties requires prior written permission from S2A Production. See [the license](LICENSE).
