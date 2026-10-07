# S2A Pilot — User guide

The rights to S2A Pilot and S2A Copilote belong to the company S2A Production. These applications were developed by Antoine CLOPIER with assistance from ChatGPT.

S2A Pilot prepares and runs multimedia shows. S2A Copilote imports its project packages into QLab 5. The app names and Edit / Show labels are the same in both languages.

## Language

The web app uses the browser’s preferred language at first launch: French for French locales, English otherwise. Use FR / EN in the header, next to Edit / Show, to override this choice. The override is saved on this device. Titles, descriptions, visuals and media filenames belonging to your project are never translated. PDF exports and package installation instructions use the currently selected interface language.

S2A Copilote uses the macOS preferred language at first launch and offers a Français / English switch in its header. Its manual preference is remembered independently from the web app.

## Quick help

On first launch, a four-step guide introduces show creation, Cue settings, Show mode and the Space shortcut for Play/Pause on computers. Actual application screenshots show a 1 minute 40 second audio track with its waveform and stage visuals. It appears before the installation prompt. The “?” button in Edit, to the left of Undo and Redo, opens it again. The guide and screenshots are available in French and English and bundled locally for offline use in browsers that support it. They also cover compatibility mode.

## Prepare a show

A new project starts without any Cue. Set the show name, then use **Cue** for a title, description and visual, or **Music / Video** to import media into a new Cue. New Cues use the current main timeline position. Return to the start before importing if you want the media to start at zero.

Cues are ordered by their time. Enter `02.41`, `02,41` or `02:41.0` for 2 minutes 41 seconds. An earlier timeline limit does not prevent a Cue from being placed later. Moving a Cue in the list changes its time to fit between adjacent Cues; dropping before the first places it at zero. A Cue at zero can still be changed or deleted.

The selected Cue has a blue outline and background. Drag the handle on its left to reorder it, or use Alt + arrow keys while the handle has keyboard focus. When dragging a timeline marker, its position, time and media band follow the pointer. The scale stays fixed until you release it. Interrupting the gesture cancels its preview.

Expand a Cue to use **Duplicate**, beside Delete. The copy starts at the same time and retains its description, visual and media settings. Its settings are independent, while the stored media file is reused. Undo / Redo can reverse these edits.

## Audio and video editing

The file editor has its own Play / Pause control, separate from the main show transport. Drag the playhead to inspect a file, set IN and OUT, and enable Loop if needed. Video includes a small preview monitor. Use − / + to zoom, then scroll horizontally. Waveforms are drawn for the visible portion at screen resolution rather than stretching a large bitmap.

New audio on the first Cue at zero uses Cut by default. Other newly added audio uses a three-second fade. Imported settings are retained. Use Add visual / Change visual for the Cue image; this is separate from its playable media.

## Main timeline and Show

Media bands appear on the timeline: green for audio, pink for video. The combined waveform reflects audible media. The timeline height adapts to its media bands. Main timeline zoom is available only in Edit, up to ×32; switching to Show restores the complete timeline.

Use Play / Pause, or press Space. The keyboard shortcut is ignored while typing, inside dialogs or when another control owns Space. Holding it does not repeatedly toggle playback. Back to start pauses playback, stops running media and returns to zero.

In Show, the active Cue is on the left on wide landscape screens and is highlighted with a blue halo. The next Cue has its title and countdown across its top, a full-width description below, then a centered 16:9 visual. On narrow screens the countdown moves below the title. Long text is retained, so the panels may grow. The main timeline can seek in Show; Cue markers remain non-editable. The video monitor appears only if the show contains video.

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


## iPad display

Version 1.4.44 matches the PWA background and reserves status-bar safe areas. Any blur added by iPadOS needs validation on a physical iPad; complete removal is not guaranteed.


Version 1.4.44: stronger blue glow around the active Cue in Show, with soft inner and outer light and no animation.


Version 1.4.44: in the final ten seconds before the next Cue, a red glow fades in and out once per second while the active Cue’s blue glow fades away. Outside this interval, blue returns. With reduced motion, red remains steady.

## Version 1.4.45 — icons and older browsers

UI icons use official Material Symbols Outlined SVGs embedded locally: no Google font, CDN or remote request. S2A Pilot and S2A Production logos are unchanged. Button labels and behavior remain the same.

In Show, “After that” keeps the first Cue clear; subsequent rows gradually fade through a CSS opacity mask and a darker background. No blur, added animation or continuous JavaScript processing. Order, content and the existing four-row display limit are unchanged.

### iOS 9.3.5 compatibility

Older browsers now try an ES5 build of the current application engine with local adapters. This restores editing commands, multiple media in a show, IN/OUT, loop and fade settings, waveforms and zoom, independent previews, touch navigation, undo/redo, the built-in PDF preview and package generation with Copilote. This branch stores media as buffers instead of Blob records. Audio fades use Web Audio when the browser allows a media source connection.

Audio import no longer forces the photo/video picker. iOS 9 needs an installed compatible document provider, such as iCloud Drive, and an accessible file. The app cannot install that provider. Try WAV and MP3 first.

When no full-app draft exists, the previous lightweight draft is recovered automatically, preserving its original. An existing full-app draft, including an empty one, takes priority. The one-track lightweight mode remains available through the compatibility link and `legacy/index.html`.

**Physical-iPad checks still required:** Safari 9 imposes playback, codec, memory and download restrictions. Video may require the native fullscreen player; audio transitions, loops, fades and downloads must be tested on the device. ZIP generation is available, but saving may depend on the share menu or an installed application. iOS 9 has no service worker: full offline support and extended video output are unavailable there. Adding a Home Screen shortcut does not remove these limits.

Tests cover icons and Play/Pause states, French/English, short/medium/long lists, desktop/tablet/phone layouts, modern-browser offline use, PDF and Copilote packages. Older-browser checks simulate missing APIs, callback Web Audio decoding, storage rejecting Blob records, touch events and draft migration; they are not physical Safari 9/iPad tests.

## Version 1.4.44 — timelines and compatibility

The white playhead matches the media timeline design. Mouse/touch dragging updates continuously in Edit and Show, with direct click/tap and arrow/Home/End navigation. Media pauses while dragging, then seeks and resumes on release if playback was active. Cancelling restores the original position. At zoom, drag the playhead to seek or swipe the background to scroll.

In Show, TIMELINE is above the active and next Cue panels. Numbered yellow markers are informational and cannot move Cues. In Edit, only the selected marker displays its number, without a blue glow. Regions before IN and after OUT are darkened; the retained selection keeps its transparent blue. ⏮ replaces Back to start text, retaining an accessible label and the same behavior.

The older-browser mode lives at `legacy/index.html`. It is selected automatically on iOS 9–12 or when the full app’s syntax/core APIs are unavailable. iOS 13+ uses the full app when these capabilities exist; this is not a guarantee for every Safari version.

It supports one music track, Cues/descriptions/images, Edit/Show, mouse/touch navigation, duplication, separate IndexedDB autosave and a printable cue sheet. It opens uncompressed project ZIPs exported by S2A Pilot. If multiple audio tracks exist, only the first is played and a message explains this. Video is not played. Imported audio IN/OUT points are respected, but trim editing, loops, fades, mixing, waveforms and video output are unavailable.

Compatibility exports use `.s2apilot.json`, including audio and visuals, and can be opened in either mode. They contain neither Copilote nor a generated PDF; the full app can subsequently export a standard package. Older Safari may open the export in a separate window rather than downloading directly. The two modes have separate local data stores; transfer projects through exports.

iOS 9–10 requires access to the site; modern offline support is not promised. From iOS 11.3, a service worker can cache app files, subject to real-device validation. Older Safari may deny automatic audio playback after seeking; starting music at zero via Play is the first scenario to verify. Limitations are shown in the UI. Tests use Chrome with simulated iOS detection and an ES5 syntax audit; no physical iPad 2 has been tested.

A magnifying glass identifies zoom controls in Edit. Show displays minutes and seconds without tenths; the fixed cue time beneath the countdown is removed. Companion downloads request fresh files to reduce stale manifests.

Compact title-only Cue bubbles below the general timeline in Edit and Show. Active Cue has a blue glow and takes collision priority, then upcoming Cues in time order. Yellow markers remain visible. Show next-Cue image uses the left half; up to four subsequent Cues appear on the right. Restart button height matches Play/Pause.

## Version 1.4.47 — help and buttons

A three-step illustrated guide opens on first launch before installation and can be reopened with “?” in Edit. French/English screenshots are bundled locally, including compatibility mode. Cue and Music / Video retain their icons without a redundant “+” in their labels. Play/Pause has a fixed width in both languages. S2A Copilote remains at 1.2.10; the package format is unchanged.

## Version 1.4.48

Show: timeline above the full Cue list on the left and active Cue details on the right, with active and next visuals side by side. Cue numbers precede their titles. All Cues remain in the list; playback and project format are unchanged. Quick-help screenshots are refreshed and have an embedded local fallback when separate PNG files are unavailable. Phone layout stacks the panels. Copilote 1.2.10 unchanged.

## Version 1.4.49

Show uses three independent cards: Cue number/title/description with the upcoming countdown and optional media badge; main visual; next Cue. Only the countdown card glows blue, then pulses red in the last ten seconds. The Cue list is on the right in landscape and below in portrait. Missing visuals use black thumbnails. Quick-help screenshots refreshed.

## Version 1.4.50

Show: consistent Active Cue / Next Cue: number headings, larger active title, green audio and pink video badges. Compact matching visual cards in landscape, with the right Cue list aligned to the total height. Help screenshots updated.

## Version 1.4.51

Show Cue list: manual scrolling blocked; automatic current-Cue tracking in landscape. In portrait, the list grows with the number of Cues, without an internal scrollbar.

## Version 1.4.52

Show Cue list heading now matches the other panel headings, with blue accent and spaced uppercase lettering. Help screenshots refreshed. Includes portrait height based on Cue count and locked manual list scrolling.

## Version 1.4.53

Show: Active visual replaces Active Cue above the image. Upcoming: Q number contains the next title and description instead of an image, with No description when empty. Green audio / pink video badges reflect its media. Help screenshots refreshed.

## Version 1.4.54

Audio/video badges use text only in Edit and Show, with green audio and pink video colors. Removed obsolete help styles and consolidated badge rendering to skip unchanged updates during playback. Help, offline, responsive Show, PDF, export with Copilote and full compatibility branch verified.

## Version 1.4.55

The glowing active Cue card displays “No description” when its description is empty.

## Version 1.4.56

Upcoming heading uses CUE number; a 16:9 thumbnail appears to the right of its title and description, with No visual if absent. Updated help screenshots.

## Version 1.4.57

Countdown is framed in a right-hand subpanel of the glowing card, labelled with the upcoming Cue number. Shows --:-- when no Cue follows. Help screenshots refreshed.

## Version 1.4.58

Active Cue number enlarged; audio/video badges sit beside it above the title, instead of below the countdown. Updated help screenshots.

## Version 1.4.60

Next Cue: fixed 16:9 thumbnail beside headings, full-width description below. Main card keeps its blue glow; red pulse is limited to the countdown subpanel. CUE is uppercase in its label. Help screenshots refreshed.

## Version 1.4.61

Blue glow fades out over 0.7 seconds while the countdown pulses red, then fades back in after the Cue change.

## Version 1.4.62

Next heading blue marker restored. Countdown glow peaks at each whole remaining second, driven by the transport animation frame with a smooth fade between beats; pauses and seeks retain its phase. No additional timer. Reduced-motion preference uses a steady glow.

## Version 1.4.63

Video mute checkbox replaced with a local Material button: crossed-out speaker when muted, speaker when enabled. Accessible state and localized tooltip; autosave and undo preserved. Unused checkbox styles removed. Offline help and Copilote/PDF export checked.

## Version 1.4.64

Removed the standalone magnifier beside zoom controls on main and media timelines. Zoom in/out icons retained; unused search SVG removed. Help screenshots updated.


## Version 1.4.65

In Show, gestures over the Cue list scroll the page while internal list scrolling stays disabled. Play/Pause resumes prepared media without unnecessary seeking; the transport button has a white glow and Music / Video uses the standard style. Audio/video Cues retain only the Cue Delete button below Duplicate; technical preparation labels are hidden. The end-of-show visual frame has a solid border. Quick help now has four steps with a 1 minute 40 second track, stage visuals the Space shortcut, audio/video formats and saving/export reminders. Copilote 1.2.10 and package compatibility are preserved.


## Version 1.4.66

Past Cue bubbles on the general timeline are grey. The active Cue keeps its blue glow and upcoming Cues remain yellow. Colors follow the transport position, including backward seeking, in Edit and Show.


## Version 1.4.67

Help step 4 keeps only the Space shortcut and the formats, saving and export notes; the repeated screenshot has been removed to save space. The first three steps retain their screenshots.


## Version 1.4.68

Help step 4 ends with the S2A Production team’s greeting, in French and English.


## Version 1.4.69

In Show, only the bottom of the Cue list fades into black when additional Cues are hidden. A fully fitting list remains sharp.


## Version 1.4.70

In Edit, a red trash icon at the right of each Cue deletes it without expanding it. The expand arrow sits to its left; the inner Delete button has been removed.

Version 1.4.70: Cue deletion in the row header, illustrated video mute tip and a shared 0.5-second Play/Pause guard for keyboard, mouse and touch, with a fading red glow.

Version 1.4.71: top fade in the Show Cue list only after scrolling, keeping the active Cue clear.

Version 1.4.72: versioned help files and screenshots prevent stale cached help. Four steps checked in the release archive.
