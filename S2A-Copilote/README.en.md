# S2A Copilote 1.2.7

The rights to S2A Pilot and S2A Copilote belong to the company S2A Production. These applications were developed by Antoine CLOPIER with assistance from ChatGPT.

[Français](README.md)

Universal macOS app: Intel and Apple Silicon, macOS 13 or later. Uses the system language initially; the Français / English header switch remembers a manual preference. User-authored project titles, Cue names and descriptions are preserved.

S2A COPILOTE 1.2.7 — MAC INSTALLATION

Intel and Apple Silicon Macs — macOS 13 or later. No compilation required. Locally signed; not notarized by Apple.

1. Extract the ZIP and move S2A Copilote.app into Applications. Replace the previous version if needed.
2. Try opening S2A Copilote once.
3. If macOS blocks it, dismiss the message and open System Settings > Privacy & Security.
4. Scroll to Security and choose Open Anyway for S2A Copilote.
5. Authenticate if requested, then confirm Open.

Open Anyway appears after an opening attempt. If it disappears, try opening the app again and return to these settings. A new version may require a new approval. Only approve the app from the official repository:
https://github.com/soundviking/S2A-Pilot

When importing, also allow S2A Copilote to control QLab. This is a separate permission.
Apple instructions: https://support.apple.com/en-us/102445


## Import and monitor



The universal .app supports Intel and Apple Silicon Macs, macOS 13 or later. Move it into Applications; no compilation is needed. It is locally signed, not notarized by Apple.

1. Try opening S2A Copilote once.
2. If blocked, open System Settings → Privacy & Security → Security.
3. Choose Open Anyway for S2A Copilote, authenticate if prompted, then confirm Open.

Open Anyway appears after an opening attempt. Try again if it has disappeared. Only approve the app from the official repository. A new version may require approval again. During import, separately allow Copilote to control QLab. See [Apple’s instructions](https://support.apple.com/en-us/102445).

Copilote automatically detects open QLab workspaces and lets you choose when several are open. Save the workspace before importing. Add multiple project packages to import each show into its own Timeline Group cue. The group retains its number and children use numbers such as 5.1, 5.2 and 5.3, avoiding existing numbers. Existing imports are not renumbered. The monitor follows imported shows and can stay on top.

## Validation limits

Chrome tests cover creation, editing, autosave, language selection, user content preservation, PDF preview/export, offline files, waveform zoom and mocked screen detection. Copilote is compiled for both architectures and its local signature is verified. Real Safari/iPad touch behavior, real extended-display playback, live QLab imports and execution on a physical Intel Mac must still be checked before show use.


## Build from source

Run `zsh build.sh` with Xcode command-line tools installed. The script builds both architectures, combines them into a universal app, generates the correct blue/orange icon and signs it locally. No notarization is performed.


## License

Use is permitted; redistribution, publication or hosting for third parties requires prior written permission from S2A Production. See [the license](LICENSE).


Version 1.2.7: fixed clipped label behind the language selector.
