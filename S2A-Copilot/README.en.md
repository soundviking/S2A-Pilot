# S2A Pilot Bridge 1.4.4

The rights to S2A Pilot and S2A Pilot Bridge belong to the company S2A Production. These applications were developed by Antoine CLOPIER with assistance from ChatGPT.

[Français](README.md)

Universal macOS app: Intel and Apple Silicon, macOS 13 or later. Uses the system language initially; the Français / English / Español / Deutsch header selector remembers a manual preference. User-authored project titles, Cue names and descriptions are preserved.

## Import and monitor

Bridge automatically detects open QLab workspaces and lets you choose when several are open. Save the workspace before importing. Add multiple project packages to import each show into its own Timeline Group cue. The group retains its number and children use numbers such as 5.1, 5.2 and 5.3, avoiding existing numbers. Existing imports are not renumbered. The monitor follows imported shows and can stay on top.

Show reuses Pilot’s Maverick layout: timeline, current and next cues, descriptions and expandable visuals. Click an image to enlarge it; click again or press Escape to return. The QLab running order displays actual cue numbers and keeps Pilot groups as one show. Green Play indicates playback; blue indicates selection. Clicking selects by unique ID without GO. Countdowns are limited to Pilot shows and the “Cue 1/2” counter is removed.

Successive imports resolve the workspace by ID. Imports retain media actions and one Wait clock; visual markers remain in Bridge. Legacy indexes without a clock ID remain readable. QLab supplies time, including pauses and seeks; connection loss freezes the last confirmed time and shows an explicit status.

See the [illustrated manuals](../docs/manual/README.md).

## Automatic layout

The cue being followed in QLab determines the layout: Iceman for native QLab elements, with no countdown on the next cue; Maverick with the usual countdown for Pilot shows. Selection alone never switches layouts. Pausing preserves the layout, and synchronization loss does not trigger a switch.

## Show filters and window

The Cue type menu supports multiple selections at once: All types, Audio, Video, S2A Pilot, Network and Other. Pilot groups remain one show even when they contain media. The chosen filter is remembered across launches and never changes playback, editing or QLab selection. If the selection is hidden, Show all reveals it.

Show uses a compact dark macOS bar with the original close/minimize/full-screen controls, the always-on-top switch and synchronization status. The duplicate web header is removed, leaving the full height below the native bar for the monitor.

## Editing in Show

Use the pencil in the running order to edit a QLab cue’s name and notes. QLab changes are reflected on the next synchronization check, including the Pilot show title. Save the workspace in QLab as usual to retain these changes after closing it.

The pencil on a Pilot card edits the marker title and description, saved immediately in Bridge’s index next to the workspace. No Memo cue is recreated. Save confirms the edit; Cancel or Escape closes without writing. Playback continues while typing. External edits are detected and a save error preserves the draft. Targets keep their IDs, timing and media.

## Validation limits

Chrome tests cover creation, editing, autosave, language selection, user content preservation, PDF preview/export, offline files, waveform zoom and mocked screen detection. Bridge is compiled for both architectures and its local signature is verified. Real Safari/iPad touch behavior, real extended-display playback, live QLab imports and execution on a physical Intel Mac must still be checked before show use.


## Build from source

Run `zsh build.sh` with Xcode command-line tools installed. The script builds both architectures, combines them into a universal app, generates the correct blue/orange icon and signs it locally. No notarization is performed.


## License

Use is permitted; redistribution, publication or hosting for third parties requires prior written permission from S2A Production. See [the license](LICENSE).
