# S2A Pilot 1.4.38 / S2A Copilote 1.2.7

🇫🇷 [Français](README.md) | 🇬🇧 **English**

![S2A Pilot](assets/social-preview.jpg)

[PWA 1.4.38](downloads/S2A-Pilot-V1.4.38-PWA.zip) · [Copilote 1.2.7 — Intel / Apple Silicon](downloads/S2A-Copilote-1.2.7-macOS-Universel.zip)

# S2A Pilot — User guide

The rights to S2A Pilot and S2A Copilote belong to the company S2A Production. These applications were developed by Antoine CLOPIER with assistance from ChatGPT.

S2A Pilot prepares and runs multimedia shows. S2A Copilote imports its project packages into QLab 5. The app names and Edit / Show labels are the same in both languages.

## Language

The web app uses the browser’s preferred language at first launch: French for French locales, English otherwise. Use FR / EN in the header, next to Edit / Show, to override this choice. The override is saved on this device. Titles, descriptions, visuals and media filenames belonging to your project are never translated. PDF exports and package installation instructions use the currently selected interface language.

S2A Copilote uses the macOS preferred language at first launch and offers a Français / English switch in its header. Its manual preference is remembered independently from the web app.

## Prepare a show

A new project starts without any Cue. Set the show name, then use **+ Cue** for a title, description and visual, or **+ Music / Video** to import media into a new Cue. New Cues use the current main timeline position. Return to the start before importing if you want the media to start at zero.

Cues are ordered by their time. Enter `02.41`, `02,41` or `02:41.0` for 2 minutes 41 seconds. An earlier timeline limit does not prevent a Cue from being placed later. Moving a Cue in the list changes its time to fit between adjacent Cues; dropping before the first places it at zero. A Cue at zero can still be changed or deleted.

The selected Cue has a blue outline and background. Drag the handle on its left to reorder it, or use Alt + arrow keys while the handle has keyboard focus. When dragging a timeline marker, its position, time and media band follow the pointer. The scale stays fixed until you release it. Interrupting the gesture cancels its preview.

Expand a Cue to use **Duplicate**, beside Delete. The copy starts at the same time and retains its description, visual and media settings. Its settings are independent, while the stored media file is reused. Undo / Redo can reverse these edits.

## Audio and video editing

The file editor has its own Play / Pause control, separate from the main show transport. Drag the playhead to inspect a file, set IN and OUT, and enable Loop if needed. Video includes a small preview monitor. Use − / + to zoom, then scroll horizontally. Waveforms are drawn for the visible portion at screen resolution rather than stretching a large bitmap.

New audio on the first Cue at zero uses Cut by default. Other newly added audio uses a three-second fade. Imported settings are retained. Use Add visual / Change visual for the Cue image; this is separate from its playable media.

## Main timeline and Show

Media bands appear on the timeline: green for audio, pink for video. The combined waveform reflects audible media. The timeline height adapts to its media bands. Main timeline zoom is available only in Edit, up to ×32; switching to Show restores the complete timeline.

Use Play / Pause, or press Space. The keyboard shortcut is ignored while typing, inside dialogs or when another control owns Space. Holding it does not repeatedly toggle playback. Back to start pauses playback, stops running media and returns to zero.

In Show, the active Cue is on the left on wide landscape screens and is highlighted with a blue halo. The next Cue has its title and countdown across its top, a full-width description below, then a centered 16:9 visual. On narrow screens the countdown moves below the title. Long text is retained, so the panels may grow. The main timeline cannot seek or move Cues in Show. The video monitor appears only if the show contains video.

## External video output

Video output appears only in Show when video is present. Automatic placement requires a browser implementing the Window Management API, permission to access screens and a real extended display. Mirroring is not a separate output. On Mac with Safari, output opens a window that you move manually to the secondary display; the app cannot verify extended-display mode. Chrome or its installed PWA can place it automatically on a detected extended display. Output is disabled on iPad / iPhone. The button status distinguishes manual and automatic placement.

The output button becomes red while the video window is active. Allow pop-ups if the browser blocks it. Click / tap the output window to enter fullscreen. Media preloading is automatic.

## Save, open and export

Edits are saved locally on this device, including text while typing. Local saves are specific to the browser, profile and site address. Use **Save as…** for a portable `.s2apilot.zip` backup and transfer. It includes show data, media, visuals, the PDF and a ready-to-install universal S2A Copilote.app. Do not delete media folders before importing into QLab. Open restores a package.

## Cue sheet PDF

**Cue sheet PDF** opens a preview inside Pilot without forcing a download. Use Download when you want the file. The PDF has a photographic header, rounded Cue blocks, audio/video counts and five standard Cues per page. Long descriptions continue onto subsequent pages. Each Cue shows elapsed time and remaining time until the end in parentheses. Project text is preserved in its original language.

## Install the PWA and update it

For local Mac testing, extract the PWA and run **Start S2A Pilot.command** (or its French equivalent). Stop any older local server before launching a new folder. Directly opening index.html supports PDF preview, but use the local launcher or HTTPS for all PWA features and companion export.

For hosting, deploy the complete folder contents over HTTPS, including hidden `.htaccess`, `i18n.js`, both manifest files, all code, icons, assets and companion files. Configure index.html as the directory index, then share `/qlab/` without an index.html suffix.

After deployment, purge Cloudflare’s cache for the app folder and remove rules forcing long cache lifetimes for HTML, JS, JSON or the service worker. The provided `.htaccess` applies no-store at an Apache origin with mod_headers; edge rules can override it. Open `actualiser.html` to replace old app caches without deleting IndexedDB projects. Do not clear site data to fix a stale version.

Pilot checks the server version on startup, when returning to the app and every five minutes while visible. It offers a newer version without forcing an update during Show or playback. The displayed version is the program actually running. A startup diagnostic appears if code fails to load. Offline use remains available after installation.

## S2A Copilote installation and QLab

The universal .app supports Intel and Apple Silicon Macs, macOS 13 or later. Move it into Applications; no compilation is needed. It is locally signed, not notarized by Apple.

1. Try opening S2A Copilote once.
2. If blocked, open System Settings → Privacy & Security → Security.
3. Choose Open Anyway for S2A Copilote, authenticate if prompted, then confirm Open.

Open Anyway appears after an opening attempt. Try again if it has disappeared. Only approve the app from the official repository. A new version may require approval again. During import, separately allow Copilote to control QLab. See [Apple’s instructions](https://support.apple.com/en-us/102445).

Copilote automatically detects open QLab workspaces and lets you choose when several are open. Save the workspace before importing. Add multiple project packages to import each show into its own Timeline Group cue. The group retains its number and children use numbers such as 5.1, 5.2 and 5.3, avoiding existing numbers. Existing imports are not renumbered. The monitor follows imported shows and can stay on top.

## Validation limits

Chrome tests cover creation, editing, autosave, language selection, user content preservation, PDF preview/export, offline files, waveform zoom and mocked screen detection. Copilote is compiled for both architectures and its local signature is verified. Real Safari/iPad touch behavior, real extended-display playback, live QLab imports and execution on a physical Intel Mac must still be checked before show use.


## License

Use is permitted; redistribution, publication or hosting for third parties requires prior written permission from S2A Production. See [the license](LICENSE).
