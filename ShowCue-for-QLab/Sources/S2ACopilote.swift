import SwiftUI
import AppKit
import Foundation

struct ShowCueProject: Codable {
    struct LegacyMedia: Codable {
        let fileName: String
        let originalFileName: String?
        let mimeType: String?
        let size: Int?
        let duration: Double?
        let path: String
        let mutedOutput: Bool?
    }

    struct MediaAction: Codable, Identifiable {
        let id: String?
        let kind: String
        let name: String?
        let mime: String?
        let size: Int?
        let duration: Double?
        let path: String?
        let inPoint: Double?
        let outPoint: Double?
        let loop: Bool?
        let transition: String?
        let fadeDuration: Double?
        let muted: Bool?

        var stableID: String { id ?? UUID().uuidString }
        var isStopAll: Bool { kind == "stopAll" }
        var isVideo: Bool { kind == "video" }
        var isAudio: Bool { kind == "audio" }
        var start: Double { max(0, inPoint ?? 0) }
        var end: Double? {
            if let outPoint, outPoint > start { return outPoint }
            if let duration, duration > start { return duration }
            return nil
        }
        var fadeSeconds: Double { max(0.1, fadeDuration ?? 3) }
    }

    struct Cue: Codable, Identifiable {
        let index: Int
        let time: Double
        let type: String?
        let name: String
        let description: String?
        let isBase: Bool?
        let imagePath: String?
        let mediaActions: [MediaAction]?

        var id: Int { index }

        var qlabDisplayName: String {
            let minutes = Int(time / 60)
            let seconds = Int(time) % 60
            let tenths = Int((time - floor(time)) * 10.0 + 0.000001)
            return String(format: "%02d:%02d.%d — %@", minutes, seconds, tenths, name)
        }

        var timeText: String {
            let minutes = Int(time / 60)
            let seconds = Int(time) % 60
            let millis = Int((time - floor(time)) * 1000.0 + 0.5)
            return String(format: "%02d:%02d.%03d", minutes, seconds, millis)
        }
    }

    let format: String
    let version: Int
    let title: String
    let qlabGroupName: String?
    let showDuration: Double?
    let showDurationOverride: Double?
    let audio: LegacyMedia?
    let video: LegacyMedia?
    let primaryMedia: String?
    let cues: [Cue]

    var isMultimedia: Bool {
        format == "showcue-multimedia-package" || version >= 4 || cues.contains { !($0.mediaActions ?? []).isEmpty }
    }

    var multimediaActionCount: Int {
        cues.reduce(0) { partial, cue in
            partial + (cue.mediaActions ?? []).filter { !$0.isStopAll }.count
        }
    }

    var resolvedLegacyMedia: (kind: String, media: LegacyMedia)? {
        if primaryMedia == "video", let video { return ("video", video) }
        if primaryMedia == "audio", let audio { return ("audio", audio) }
        if let audio { return ("audio", audio) }
        if let video { return ("video", video) }
        return nil
    }

    var resolvedShowDuration: Double {
        if let showDuration, showDuration > 0 { return showDuration }
        if let showDurationOverride, showDurationOverride > 0 { return showDurationOverride }
        var lastFinite = cues.map(\.time).max() ?? 0
        for cue in cues {
            for action in cue.mediaActions ?? [] where !action.isStopAll && action.loop != true {
                let end = action.end ?? action.duration ?? 0
                let segment = max(0, end - action.start)
                lastFinite = max(lastFinite, cue.time + segment)
            }
        }
        return max(10, lastFinite + 10)
    }
}



struct QueuedShowCuePackage: Identifiable {
    let id = UUID()
    let sourceURL: URL
    let extractedURL: URL
    let project: ShowCueProject
}

struct WorkspaceInfo {
    let id: String
    let name: String
    let workspacePath: String

    var projectFolder: URL? {
        guard !workspacePath.isEmpty else { return nil }
        return URL(fileURLWithPath: workspacePath).deletingLastPathComponent()
    }
}


struct SavedShowCue: Codable, Identifiable {
    let groupID: String
    let mediaID: String?
    let audioID: String? // Compatibilité avec les index créés avant la prise en charge vidéo.
    let title: String
    let cues: [ShowCueProject.Cue]
    let imagePaths: [String: String]
    let importedAt: Date
    var id: String { groupID }
}

struct SavedShowCueIndex: Codable {
    var version: Int = 1
    var shows: [SavedShowCue]
}

enum ShowCueError: LocalizedError {
    case invalidPackage(String)
    case commandFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidPackage(let s): return s
        case .commandFailed(let s): return s
        }
    }
}

final class AppModel: ObservableObject {
    @Published var packages: [QueuedShowCuePackage] = []
    @Published var workspace: WorkspaceInfo?
    @Published var status = "Choisis un package S2A Pilot."
    @Published var isBusy = false
    @Published var errorMessage: String?

    @Published var savedShows: [SavedShowCue] = []
    @Published var activeShow: SavedShowCue?
    @Published var visualElapsed: Double = 0
    @Published var visualRunning = false
    @Published var visualStatus = "En attente d’un numéro S2A Pilot"
    @Published var visualAlwaysOnTop = true

    private var monitorTimer: Timer?
    private var monitorPollInFlight = false

    private var extractedURL: URL?

    deinit {
        monitorTimer?.invalidate()
        for item in packages {
            try? FileManager.default.removeItem(at: item.extractedURL)
        }
        cleanup()
    }

    func choosePackage() {
        let panel = NSOpenPanel()
        panel.title = "Choisir un ou plusieurs packages S2A Pilot"
        panel.allowedContentTypes = []
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.canChooseFiles = true

        if panel.runModal() == .OK {
            loadPackages(panel.urls)
        }
    }

    func loadPackages(_ urls: [URL]) {
        guard !urls.isEmpty else { return }

        isBusy = true
        errorMessage = nil
        status = "Lecture de \(urls.count) package\(urls.count > 1 ? "s" : "")…"

        DispatchQueue.global(qos: .userInitiated).async {
            var loaded: [QueuedShowCuePackage] = []
            var failures: [String] = []

            for url in urls {
                do {
                    let result = try self.extractAndReadPackage(url)
                    loaded.append(
                        QueuedShowCuePackage(
                            sourceURL: url,
                            extractedURL: result.folder,
                            project: result.project
                        )
                    )
                } catch {
                    failures.append("\(url.lastPathComponent) : \(error.localizedDescription)")
                }
            }

            DispatchQueue.main.async {
                self.packages.append(contentsOf: loaded)
                self.isBusy = false

                if failures.isEmpty {
                    self.status = "\(loaded.count) package\(loaded.count > 1 ? "s" : "") chargé\(loaded.count > 1 ? "s" : "")."
                } else {
                    self.status = "\(loaded.count) chargé\(loaded.count > 1 ? "s" : ""), \(failures.count) échec\(failures.count > 1 ? "s" : "")."
                    self.errorMessage = failures.joined(separator: "\n")
                }

                self.refreshWorkspace()
            }
        }
    }

    func removePackage(_ id: UUID) {
        guard let index = packages.firstIndex(where: { $0.id == id }) else { return }
        let item = packages.remove(at: index)
        try? FileManager.default.removeItem(at: item.extractedURL)
        status = packages.isEmpty ? "Choisis un ou plusieurs packages S2A Pilot." : "\(packages.count) package\(packages.count > 1 ? "s" : "") prêt\(packages.count > 1 ? "s" : "") à importer."
    }

    func clearPackages() {
        for item in packages {
            try? FileManager.default.removeItem(at: item.extractedURL)
        }
        packages.removeAll()
        status = "Choisis un ou plusieurs packages S2A Pilot."
    }

    func loadPackage(_ url: URL) {
        loadPackages([url])
    }

    func refreshWorkspace() {
        errorMessage = nil
        do {
            let info = try qlabFrontWorkspace()
            workspace = info
            loadSavedShows(for: info)
            status = "Workspace QLab détecté : \(info.name)"
        } catch {
            workspace = nil
            savedShows = []
            activeShow = nil
            status = "Aucun workspace QLab détecté."
            errorMessage = error.localizedDescription
        }
    }

    func importIntoQLab() {
        guard !packages.isEmpty else { return }

        isBusy = true
        errorMessage = nil
        status = "Vérification de QLab…"

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let initial = try self.qlabFrontWorkspace()

                DispatchQueue.main.async {
                    let names = self.packages.map { "• \($0.project.title)" }.joined(separator: "\n")

                    let alert = NSAlert()
                    alert.messageText = self.packages.count == 1
                        ? "Importer « \(self.packages[0].project.title) » ?"
                        : "Importer \(self.packages.count) conduites S2A Pilot ?"
                    alert.informativeText = """
                    Workspace QLab :
                    \(initial.name)

                    \(names)

                    Chaque numéro sera créé dans son propre Group cue Start First.
                    """
                    alert.addButton(withTitle: "Importer")
                    alert.addButton(withTitle: "Annuler")
                    alert.alertStyle = .informational

                    guard alert.runModal() == .alertFirstButtonReturn else {
                        self.isBusy = false
                        self.status = "Import annulé."
                        return
                    }

                    let queueSnapshot = self.packages

                    DispatchQueue.global(qos: .userInitiated).async {
                        do {
                            var current = try self.qlabFrontWorkspace()
                            guard current.id == initial.id else {
                                throw ShowCueError.commandFailed("Le workspace QLab au premier plan a changé. Import annulé.")
                            }

                            var importedCount = 0

                            for item in queueSnapshot {
                                current = try self.qlabFrontWorkspace()
                                guard current.id == initial.id else {
                                    throw ShowCueError.commandFailed("Le workspace QLab au premier plan a changé pendant l’import.")
                                }

                                let result = try self.performImport(
                                    project: item.project,
                                    folder: item.extractedURL,
                                    workspaceID: initial.id
                                )

                                let record = try self.makeSavedShowRecord(
                                    project: item.project,
                                    groupID: result.groupID,
                                    mediaID: result.mediaID,
                                    imageURLs: result.imageURLs,
                                    workspace: current
                                )
                                try self.saveShowRecord(record, for: current)
                                importedCount += 1
                            }

                            DispatchQueue.main.async {
                                self.isBusy = false
                                self.workspace = current
                                self.loadSavedShows(for: current)
                                self.visualElapsed = 0
                                self.visualRunning = false
                                self.visualStatus = "En attente d’un numéro S2A Pilot"
                                self.startVisualMonitor()
                                self.status = "\(importedCount) conduite\(importedCount > 1 ? "s" : "") S2A Pilot importée\(importedCount > 1 ? "s" : "") dans « \(current.name) »."

                                // Successful batch import clears the queue.
                                self.clearPackages()
                            }
                        } catch {
                            DispatchQueue.main.async {
                                self.isBusy = false
                                self.errorMessage = error.localizedDescription
                                self.status = "Échec de l’import."
                            }
                        }
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.isBusy = false
                    self.errorMessage = error.localizedDescription
                    self.status = "Impossible de détecter QLab."
                }
            }
        }
    }

    private func extractAndReadPackage(_ url: URL) throws -> (folder: URL, project: ShowCueProject) {
        cleanup()

        let fm = FileManager.default
        let temp = fm.temporaryDirectory.appendingPathComponent("S2APilot-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: temp, withIntermediateDirectories: true)

        guard url.pathExtension.lowercased() == "zip" else {
            throw ShowCueError.invalidPackage("S2A Copilote attend un fichier .s2apilot.zip, .showcue.zip ou .zip.")
        }
        try run("/usr/bin/ditto", ["-x", "-k", url.path, temp.path])

        let manifest = temp.appendingPathComponent("conduite.json")
        guard fm.fileExists(atPath: manifest.path) else {
            throw ShowCueError.invalidPackage("conduite.json est introuvable dans le package.")
        }

        let data = try Data(contentsOf: manifest)
        let project = try JSONDecoder().decode(ShowCueProject.self, from: data)
        let acceptedFormats = ["showcue-multimedia-package", "show-cue-prep-package"]
        guard acceptedFormats.contains(project.format) || project.version >= 4 else {
            throw ShowCueError.invalidPackage("Format de package S2A Pilot non reconnu.")
        }

        let root = temp.standardizedFileURL.path + "/"
        if project.isMultimedia {
            for cue in project.cues {
                for action in cue.mediaActions ?? [] where !action.isStopAll {
                    guard let path = action.path, !path.isEmpty else {
                        throw ShowCueError.invalidPackage("Un média de la Cue \(cue.index) n’a pas de chemin dans le package.")
                    }
                    let fileURL = temp.appendingPathComponent(path).standardizedFileURL
                    guard fileURL.path.hasPrefix(root), fm.fileExists(atPath: fileURL.path) else {
                        throw ShowCueError.invalidPackage("Média introuvable : \(path)")
                    }
                }
            }
        } else if let resolved = project.resolvedLegacyMedia {
            let fileURL = temp.appendingPathComponent(resolved.media.path).standardizedFileURL
            guard fileURL.path.hasPrefix(root), fm.fileExists(atPath: fileURL.path) else {
                throw ShowCueError.invalidPackage("Le média principal est introuvable : \(resolved.media.path)")
            }
        } else {
            throw ShowCueError.invalidPackage("Le package ne contient aucun média exploitable.")
        }

        return (temp, project)
    }

    private func qlabFrontWorkspace() throws -> WorkspaceInfo {
        let script = """
        tell application id "com.figure53.QLab.5"
            if (count of workspaces) is 0 then error "Aucun workspace QLab n’est ouvert."
            set w to front workspace
            set wid to unique id of w

            try
                set wname to name of w
            on error
                set wname to "Workspace QLab"
            end try

            set wpath to ""
            try
                set rawPath to path of w
                if rawPath is not missing value and rawPath is not "" then
                    try
                        set wpath to POSIX path of (rawPath as alias)
                    on error
                        set wpath to rawPath as text
                    end try
                end if
            end try

            return wid & linefeed & wname & linefeed & wpath
        end tell
        """

        let output = try run("/usr/bin/osascript", ["-e", script])
        let parts = output
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)

        guard let id = parts.first, !id.isEmpty else {
            throw ShowCueError.commandFailed("QLab n’a pas renvoyé d’identifiant de workspace.")
        }

        let name = parts.count > 1
            ? parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
            : "Workspace QLab"

        let path = parts.count > 2
            ? parts.dropFirst(2).joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            : ""

        return WorkspaceInfo(
            id: id,
            name: name.isEmpty ? "Workspace QLab" : name,
            workspacePath: path
        )
    }

    private func performImport(project: ShowCueProject, folder: URL, workspaceID: String) throws -> (groupID: String, mediaID: String?, imageURLs: [Int: URL]) {
        let current = try qlabFrontWorkspace()
        guard current.id == workspaceID else { throw ShowCueError.commandFailed("Le workspace QLab au premier plan a changé.") }
        guard let projectFolder = current.projectFolder else { throw ShowCueError.commandFailed("Le workspace QLab doit être enregistré avant l’import.") }

        let fm = FileManager.default
        let packageRoot = folder.standardizedFileURL.path + "/"
        let mediaFolder = projectFolder.appendingPathComponent("S2A Pilot Media", isDirectory: true).appendingPathComponent(safeFileName(project.title), isDirectory: true)
        let imageFolder = projectFolder.appendingPathComponent("images", isDirectory: true).appendingPathComponent(safeFileName(project.title), isDirectory: true)
        try fm.createDirectory(at: mediaFolder, withIntermediateDirectories: true)
        try fm.createDirectory(at: imageFolder, withIntermediateDirectories: true)

        var imageDestinations: [Int: URL] = [:]
        for cue in project.cues {
            guard let imagePath = cue.imagePath, !imagePath.isEmpty else { continue }
            let source = folder.appendingPathComponent(imagePath).standardizedFileURL
            guard source.path.hasPrefix(packageRoot), fm.fileExists(atPath: source.path) else { continue }
            let destination = imageFolder.appendingPathComponent(String(format: "%02d-", cue.index) + safeFileName(source.lastPathComponent))
            try copyReplacing(source, to: destination)
            imageDestinations[cue.index] = destination
        }

        var destinationForAction: [String: URL] = [:]
        if project.isMultimedia {
            for cue in project.cues {
                for (offset, action) in (cue.mediaActions ?? []).enumerated() where !action.isStopAll {
                    guard let path = action.path else { continue }
                    let source = folder.appendingPathComponent(path).standardizedFileURL
                    guard source.path.hasPrefix(packageRoot), fm.fileExists(atPath: source.path) else {
                        throw ShowCueError.invalidPackage("Média introuvable : \(path)")
                    }
                    let key = action.id ?? "cue\(cue.index)-\(offset)"
                    if destinationForAction[key] == nil {
                        let name = safeFileName(action.name ?? source.lastPathComponent)
                        let destination = mediaFolder.appendingPathComponent(String(format: "%02d-", cue.index) + name)
                        try copyReplacing(source, to: destination)
                        destinationForAction[key] = destination
                    }
                }
            }
        }

        if !project.isMultimedia, let legacy = project.resolvedLegacyMedia {
            let source = folder.appendingPathComponent(legacy.media.path).standardizedFileURL
            let destination = mediaFolder.appendingPathComponent(safeFileName(legacy.media.originalFileName ?? legacy.media.fileName))
            try copyReplacing(source, to: destination)
            destinationForAction["legacy"] = destination
        }

        var lines: [String] = []
        lines.append("tell application id \"com.figure53.QLab.5\"")
        lines.append("if (count of workspaces) is 0 then error \"Aucun workspace QLab n’est ouvert.\"")
        lines.append("set targetWorkspace to front workspace")
        lines.append("if (unique id of targetWorkspace) is not \(asAppleString(workspaceID)) then error \"Le workspace QLab au premier plan a changé.\"")
        lines.append("make targetWorkspace type \"Group\"")
        lines.append("set showGroup to last item of (selected of targetWorkspace as list)")
        lines.append("set q name of showGroup to \(asAppleString(project.title))")
        lines.append("set mode of showGroup to timeline")

        var firstMediaVariable: String? = nil
        var mediaCounter = 0
        var utilityCounter = 0
        var priorAudioVariables: [String] = []
        var priorVideoVariables: [String] = []

        func qlabTime(_ value: Double) -> String { String(format: "%.3f", value) }
        func appendStop(target: String, at time: Double, label: String) {
            utilityCounter += 1
            let variable = "stopCue\(utilityCounter)"
            lines.append("make targetWorkspace type \(asAppleString("Stop"))")
            lines.append("set \(variable) to last item of (selected of targetWorkspace as list)")
            lines.append("set q name of \(variable) to \(asAppleString(label))")
            lines.append("set cue target of \(variable) to \(target)")
            lines.append("set pre wait of \(variable) to \(qlabTime(time))")
            lines.append("move \(variable) to end of showGroup")
        }
        func appendAudioFade(target: String, at time: Double, duration: Double, toDB: Double, stopWhenDone: Bool, label: String) {
            utilityCounter += 1
            let variable = "fadeCue\(utilityCounter)"
            lines.append("make targetWorkspace type \(asAppleString("Fade"))")
            lines.append("set \(variable) to last item of (selected of targetWorkspace as list)")
            lines.append("set q name of \(variable) to \(asAppleString(label))")
            lines.append("set cue target of \(variable) to \(target)")
            lines.append("set pre wait of \(variable) to \(qlabTime(time))")
            lines.append("set temp duration of \(variable) to \(qlabTime(duration))")
            lines.append("setLevel \(variable) row 0 column 0 db \(qlabTime(toDB))")
            if stopWhenDone { lines.append("set stop target when done of \(variable) to true") }
            lines.append("move \(variable) to end of showGroup")
        }
        func appendVideoFade(target: String, at time: Double, duration: Double, stopWhenDone: Bool, label: String) {
            utilityCounter += 1
            let variable = "fadeCue\(utilityCounter)"
            lines.append("make targetWorkspace type \(asAppleString("Fade"))")
            lines.append("set \(variable) to last item of (selected of targetWorkspace as list)")
            lines.append("set q name of \(variable) to \(asAppleString(label))")
            lines.append("set cue target of \(variable) to \(target)")
            lines.append("set pre wait of \(variable) to \(qlabTime(time))")
            lines.append("set temp duration of \(variable) to \(qlabTime(duration))")
            lines.append("set do opacity of \(variable) to true")
            lines.append("set opacity of \(variable) to 0")
            if stopWhenDone { lines.append("set stop target when done of \(variable) to true") }
            lines.append("move \(variable) to end of showGroup")
        }

        if project.isMultimedia {
            for cue in project.cues.sorted(by: { $0.time < $1.time }) {
                let cueTime = qlabTime(cue.time)
                lines.append("make targetWorkspace type \(asAppleString("Memo"))")
                lines.append("set cueMemo to last item of (selected of targetWorkspace as list)")
                lines.append("set q name of cueMemo to \(asAppleString(cue.qlabDisplayName))")
                lines.append("set pre wait of cueMemo to \(cueTime)")
                if let description = cue.description, !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    lines.append("set notes of cueMemo to \(asAppleString(description))")
                }
                lines.append("move cueMemo to end of showGroup")

                for action in (cue.mediaActions ?? []).filter({ $0.isStopAll }) {
                    if action.transition == "fade" {
                        let d = action.fadeSeconds
                        for target in priorAudioVariables {
                            appendAudioFade(target: target, at: cue.time, duration: d, toDB: -120, stopWhenDone: true, label: "FONDU GLOBAL — AUDIO")
                        }
                        for target in priorVideoVariables {
                            appendVideoFade(target: target, at: cue.time, duration: d, stopWhenDone: true, label: "FONDU GLOBAL — VIDÉO")
                        }
                    } else {
                        for target in priorAudioVariables {
                            appendStop(target: target, at: cue.time, label: "STOP GLOBAL — AUDIO")
                        }
                        for target in priorVideoVariables {
                            appendStop(target: target, at: cue.time, label: "STOP GLOBAL — VIDÉO")
                        }
                    }
                    // Après un arrêt/fondu global, aucun média antérieur ne doit être
                    // considéré comme encore actif pour les CUT/FONDU suivants.
                    priorAudioVariables.removeAll()
                    priorVideoVariables.removeAll()
                }

                for (offset, action) in (cue.mediaActions ?? []).enumerated() where !action.isStopAll {
                    let key = action.id ?? "cue\(cue.index)-\(offset)"
                    guard let destination = destinationForAction[key] else { continue }
                    mediaCounter += 1
                    let variable = "mediaCue\(mediaCounter)"
                    if firstMediaVariable == nil { firstMediaVariable = variable }
                    let cueType = action.isVideo ? "Video" : "Audio"
                    let prefix = action.isVideo ? "VIDÉO" : "AUDIO"
                    let mediaName = "\(prefix) — \(cue.name) — \(action.name ?? destination.lastPathComponent)"

                    if action.isAudio {
                        if action.transition == "fade" {
                            for target in priorAudioVariables {
                                appendAudioFade(target: target, at: cue.time, duration: action.fadeSeconds, toDB: -120, stopWhenDone: true, label: "FONDU SORTIE — \(cue.name)")
                            }
                        } else {
                            for target in priorAudioVariables { appendStop(target: target, at: cue.time, label: "CUT AUDIO — \(cue.name)") }
                        }
                        priorAudioVariables.removeAll()
                    } else if action.isVideo {
                        for target in priorVideoVariables { appendStop(target: target, at: cue.time, label: "CUT VIDÉO — \(cue.name)") }
                        priorVideoVariables.removeAll()
                    }

                    lines.append("make targetWorkspace type \(asAppleString(cueType))")
                    lines.append("set \(variable) to last item of (selected of targetWorkspace as list)")
                    lines.append("set q name of \(variable) to \(asAppleString(mediaName))")
                    lines.append("set file target of \(variable) to (POSIX file \(asAppleString(destination.path)) as alias)")
                    lines.append("set pre wait of \(variable) to \(cueTime)")
                    lines.append("set start time of \(variable) to \(qlabTime(action.start))")
                    if let actionEnd = action.end { lines.append("set end time of \(variable) to \(qlabTime(actionEnd))") }
                    lines.append("set infinite loop of \(variable) to \(action.loop == true ? "true" : "false")")
                    if action.isVideo && action.muted == true {
                        // Une vidéo déclarée muette dans S2A Pilot doit rester muette dans QLab.
                        // La méthode la plus robuste consiste à dépatcher sa sortie audio (0 = none).
                        // On garde deux fallbacks non bloquants pour les configurations particulières.
                        lines.append("try")
                        lines.append("set audio output patch number of \(variable) to 0")
                        lines.append("on error")
                        lines.append("try")
                        lines.append("setLevel \(variable) row 0 column 0 db -120")
                        lines.append("end try")
                        lines.append("try")
                        lines.append("setMute \(variable) output 0 mute true")
                        lines.append("end try")
                        lines.append("end try")
                    }
                    if action.isAudio && action.transition == "fade" {
                        lines.append("setLevel \(variable) row 0 column 0 db -120")
                    }
                    lines.append("move \(variable) to end of showGroup")

                    if action.isAudio && action.transition == "fade" {
                        appendAudioFade(target: variable, at: cue.time, duration: action.fadeSeconds, toDB: 0, stopWhenDone: false, label: "FONDU ENTRÉE — \(cue.name)")
                    }
                    if action.isAudio { priorAudioVariables.append(variable) }
                    if action.isVideo { priorVideoVariables.append(variable) }
                }
            }

            lines.append("make targetWorkspace type \(asAppleString("Memo"))")
            lines.append("set endMemo to last item of (selected of targetWorkspace as list)")
            lines.append("set q name of endMemo to \(asAppleString("FIN DE CONDUITE S2A PILOT"))")
            lines.append("set pre wait of endMemo to \(qlabTime(project.resolvedShowDuration))")
            lines.append("move endMemo to end of showGroup")
        } else if let legacy = project.resolvedLegacyMedia, let destination = destinationForAction["legacy"] {
            let cueType = legacy.kind == "video" ? "Video" : "Audio"
            lines.append("make targetWorkspace type \(asAppleString(cueType))")
            lines.append("set legacyCue to last item of (selected of targetWorkspace as list)")
            lines.append("set q name of legacyCue to \(asAppleString(project.title))")
            lines.append("set file target of legacyCue to (POSIX file \(asAppleString(destination.path)) as alias)")
            if legacy.kind == "video" && legacy.media.mutedOutput == true {
                lines.append("try")
                lines.append("set audio output patch number of legacyCue to 0")
                lines.append("on error")
                lines.append("try")
                lines.append("setLevel legacyCue row 0 column 0 db -120")
                lines.append("end try")
                lines.append("try")
                lines.append("setMute legacyCue output 0 mute true")
                lines.append("end try")
                lines.append("end try")
            }
            lines.append("move legacyCue to end of showGroup")
            firstMediaVariable = "legacyCue"
            for cue in project.cues.sorted(by: { $0.time < $1.time }) {
                lines.append("make targetWorkspace type \"Memo\"")
                lines.append("set cueMemo to last item of (selected of targetWorkspace as list)")
                lines.append("set q name of cueMemo to \(asAppleString(cue.qlabDisplayName))")
                lines.append("set pre wait of cueMemo to \(String(format: "%.3f", cue.time))")
                lines.append("move cueMemo to end of showGroup")
            }
        }

        if let firstMediaVariable {
            lines.append("return (uniqueID of showGroup as text) & tab & (uniqueID of \(firstMediaVariable) as text)")
        } else {
            lines.append("return (uniqueID of showGroup as text) & tab & \"\"")
        }
        lines.append("end tell")

        let output = try run("/usr/bin/osascript", ["-e", lines.joined(separator: "\n")])
        let ids = output.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
        guard let groupID = ids.first, !groupID.isEmpty else { throw ShowCueError.commandFailed("QLab n’a pas renvoyé l’identifiant du Group cue importé.") }
        let mediaID = ids.count > 1 && !ids[1].isEmpty ? ids[1] : nil
        return (groupID, project.isMultimedia ? nil : mediaID, imageDestinations)
    }

    private func showCueDirectory(for workspace: WorkspaceInfo) throws -> URL {
        guard let projectFolder = workspace.projectFolder else {
            throw ShowCueError.commandFailed("Le workspace QLab doit être enregistré.")
        }
        return projectFolder.appendingPathComponent("S2A Pilot", isDirectory: true)
    }

    private func indexURL(for workspace: WorkspaceInfo) throws -> URL {
        try showCueDirectory(for: workspace).appendingPathComponent("index.json")
    }

    private func makeSavedShowRecord(project: ShowCueProject, groupID: String, mediaID: String?, imageURLs: [Int: URL], workspace: WorkspaceInfo) throws -> SavedShowCue {
        guard let projectFolder = workspace.projectFolder else {
            throw ShowCueError.commandFailed("Le workspace QLab doit être enregistré.")
        }
        let basePath = projectFolder.standardizedFileURL.path
        var relativeImages: [String: String] = [:]
        for (cueIndex, imageURL) in imageURLs {
            let fullPath = imageURL.standardizedFileURL.path
            if fullPath.hasPrefix(basePath + "/") {
                relativeImages[String(cueIndex)] = String(fullPath.dropFirst(basePath.count + 1))
            } else {
                relativeImages[String(cueIndex)] = fullPath
            }
        }
        return SavedShowCue(groupID: groupID, mediaID: mediaID, audioID: project.resolvedLegacyMedia?.kind == "audio" ? mediaID : nil, title: project.title, cues: project.cues.sorted(by: { $0.time < $1.time }), imagePaths: relativeImages, importedAt: Date())
    }

    private func loadIndexData(for workspace: WorkspaceInfo) throws -> SavedShowCueIndex {
        let url = try indexURL(for: workspace)
        guard FileManager.default.fileExists(atPath: url.path) else {
            return SavedShowCueIndex(shows: [])
        }
        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(SavedShowCueIndex.self, from: data)
    }

    private func writeIndexData(_ index: SavedShowCueIndex, for workspace: WorkspaceInfo) throws {
        let directory = try showCueDirectory(for: workspace)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(index)
        try data.write(to: indexURL(for: workspace), options: .atomic)
    }

    private func loadSavedShows(for workspace: WorkspaceInfo) {
        guard workspace.projectFolder != nil else {
            savedShows = []
            activeShow = nil
            return
        }
        do {
            let index = try loadIndexData(for: workspace)
            savedShows = index.shows.sorted(by: { $0.importedAt < $1.importedAt })
            if let currentActive = activeShow, !savedShows.contains(where: { $0.groupID == currentActive.groupID }) {
                activeShow = nil
            }
        } catch {
            savedShows = []
            activeShow = nil
            errorMessage = "Impossible de lire l’index S2A Pilot : \(error.localizedDescription)"
        }
    }

    private func saveShowRecord(_ record: SavedShowCue, for workspace: WorkspaceInfo) throws {
        var index = try loadIndexData(for: workspace)
        index.shows.removeAll(where: { $0.groupID == record.groupID })
        index.shows.append(record)
        try writeIndexData(index, for: workspace)
    }

    func startVisualMonitor() {
        monitorTimer?.invalidate()
        guard workspace?.projectFolder != nil, !savedShows.isEmpty else {
            activeShow = nil
            visualRunning = false
            visualElapsed = 0
            visualStatus = "En attente d’un numéro S2A Pilot"
            return
        }
        monitorTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in self?.pollVisualMonitor() }
        if let monitorTimer { RunLoop.main.add(monitorTimer, forMode: .common) }
        pollVisualMonitor()
    }

    func stopVisualMonitor() {
        monitorTimer?.invalidate()
        monitorTimer = nil
        monitorPollInFlight = false
    }

    private func pollVisualMonitor() {
        guard !monitorPollInFlight, let workspace, !savedShows.isEmpty else { return }
        monitorPollInFlight = true
        let workspaceID = workspace.id
        let showsSnapshot = savedShows

        DispatchQueue.global(qos: .utility).async {
            defer { DispatchQueue.main.async { self.monitorPollInFlight = false } }
            do {
                var scriptLines: [String] = []
                scriptLines.append("tell application id \"com.figure53.QLab.5\"")
                scriptLines.append("if (count of workspaces) is 0 then return \"NO_WORKSPACE\"")
                scriptLines.append("set w to front workspace")
                scriptLines.append("if (unique id of w) is not \(self.asAppleString(workspaceID)) then return \"WRONG_WORKSPACE\"")
                scriptLines.append("set resultText to \"\"")
                for show in showsSnapshot {
                    scriptLines.append("try")
                    if let mediaID = show.mediaID, !mediaID.isEmpty {
                        scriptLines.append("set trackedCue to cue id \(self.asAppleString(mediaID)) of w")
                    } else if let audioID = show.audioID, !audioID.isEmpty {
                        // Compatibilité avec les index audio créés avant la version 1.1.
                        scriptLines.append("set trackedCue to cue id \(self.asAppleString(audioID)) of w")
                    } else {
                        // Compatibilité avec les index très anciens sans identifiant de média.
                        scriptLines.append("set trackedCue to cue id \(self.asAppleString(show.groupID)) of w")
                    }
                    scriptLines.append("set resultText to resultText & \(self.asAppleString(show.groupID)) & tab & (running of trackedCue as text) & tab & (paused of trackedCue as text) & tab & (action elapsed of trackedCue as text) & linefeed")
                    scriptLines.append("end try")
                }
                scriptLines.append("return resultText")
                scriptLines.append("end tell")

                let output = try self.run("/usr/bin/osascript", ["-e", scriptLines.joined(separator: "\n")])
                if output == "NO_WORKSPACE" {
                    DispatchQueue.main.async { self.activeShow=nil; self.visualRunning=false; self.visualElapsed=0; self.visualStatus="QLab n’a aucun workspace ouvert" }
                    return
                }
                if output == "WRONG_WORKSPACE" {
                    DispatchQueue.main.async { self.activeShow=nil; self.visualRunning=false; self.visualElapsed=0; self.visualStatus="Le workspace QLab au premier plan a changé" }
                    return
                }

                struct RuntimeState { let id:String; let running:Bool; let paused:Bool; let elapsed:Double }
                let states:[RuntimeState] = output.split(separator:"\n").compactMap { line in
                    let f=line.split(separator:"\t",omittingEmptySubsequences:false).map(String.init)
                    guard f.count >= 4 else { return nil }
                    return RuntimeState(id:f[0], running:f[1].lowercased()=="true", paused:f[2].lowercased()=="true", elapsed:Double(f[3].replacingOccurrences(of:",",with:".")) ?? 0)
                }
                let live=states.filter{$0.running && !$0.paused}.sorted{$0.elapsed < $1.elapsed}.first
                let pausedState=states.filter{$0.paused}.sorted{$0.elapsed < $1.elapsed}.first
                let selected=live ?? pausedState

                DispatchQueue.main.async {
                    guard let selected, let show=showsSnapshot.first(where:{$0.groupID==selected.id}) else {
                        self.activeShow=nil; self.visualRunning=false; self.visualElapsed=0; self.visualStatus="En attente d’un numéro S2A Pilot"; return
                    }
                    self.activeShow=show
                    self.visualElapsed=max(0,selected.elapsed)
                    self.visualRunning=selected.running && !selected.paused
                    self.visualStatus=selected.paused ? "Pause" : "Lecture"
                }
            } catch {
                DispatchQueue.main.async { self.activeShow=nil; self.visualRunning=false; self.visualElapsed=0; self.visualStatus="Visualiseur indisponible : \(error.localizedDescription)" }
            }
        }
    }

    var nextVisualCue: ShowCueProject.Cue? {
        guard let activeShow else { return nil }
        return activeShow.cues.sorted(by:{$0.time < $1.time}).first(where:{$0.time > visualElapsed + 0.02})
    }

    var nextVisualImageURL: URL? {
        guard let activeShow, let cue=nextVisualCue, let path=activeShow.imagePaths[String(cue.index)], let projectFolder=workspace?.projectFolder else { return nil }
        if path.hasPrefix("/") { return URL(fileURLWithPath:path) }
        return projectFolder.appendingPathComponent(path)
    }

    var nextVisualCountdown: Double? {
        guard let cue=nextVisualCue else { return nil }
        return max(0,cue.time-visualElapsed)
    }

    private func safeFileName(_ name: String) -> String {
        let invalid = CharacterSet(charactersIn: "/:\\\\?%*|\\\"<>")
        let components = name.components(separatedBy: invalid)
        let joined = components.joined(separator: "-").trimmingCharacters(in: .whitespacesAndNewlines)
        return joined.isEmpty ? "media" : joined
    }

    private func copyReplacing(_ source: URL, to destination: URL) throws {
        let fm = FileManager.default
        if fm.fileExists(atPath: destination.path) {
            try fm.removeItem(at: destination)
        }
        try fm.copyItem(at: source, to: destination)
    }

    private func asAppleString(_ s: String) -> String {
        let escaped = s
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
        return "\"\(escaped)\""
    }

    @discardableResult
    private func run(_ executable: String, _ arguments: [String], stdin: String? = nil) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments

        let out = Pipe()
        let err = Pipe()
        process.standardOutput = out
        process.standardError = err

        if let stdin {
            let input = Pipe()
            process.standardInput = input
            try process.run()
            input.fileHandleForWriting.write(stdin.data(using: .utf8)!)
            input.fileHandleForWriting.closeFile()
        } else {
            try process.run()
        }

        process.waitUntilExit()

        let outData = out.fileHandleForReading.readDataToEndOfFile()
        let errData = err.fileHandleForReading.readDataToEndOfFile()
        let stdout = String(data: outData, encoding: .utf8) ?? ""
        let stderr = String(data: errData, encoding: .utf8) ?? ""

        guard process.terminationStatus == 0 else {
            throw ShowCueError.commandFailed(stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? stdout : stderr)
        }

        return stdout.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func cleanup() {
        if let extractedURL {
            try? FileManager.default.removeItem(at: extractedURL)
        }
        extractedURL = nil
    }
}

struct ContentView: View {
    @ObservedObject var model: AppModel
    @Environment(\.openWindow) private var openWindow

    private var workspaceStatusColor: Color {
        if model.workspace?.projectFolder != nil { return .green }
        if model.workspace != nil { return .orange }
        return .red
    }

    var body: some View {
        VStack(spacing: 18) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("S2A Copilote")
                        .font(.system(size: 20, weight: .semibold))
                    Text("Import de conduites S2A Pilot V5 dans QLab 5 — S2A Copilote 1.2.2")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if model.isBusy {
                    ProgressView()
                        .controlSize(.small)
                }
            }

            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: "shippingbox")
                        .font(.system(size: 20))
                        .foregroundStyle(.secondary)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Package S2A Pilot")
                            .font(.headline)
                        Text(model.packages.isEmpty ? "Aucun package sélectionné" : "\(model.packages.count) package\(model.packages.count > 1 ? "s" : "") sélectionné\(model.packages.count > 1 ? "s" : "")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }

                    Spacer()

                    Button("Ajouter…") {
                        model.choosePackage()
                    }
                    .disabled(model.isBusy)
                }

                if !model.packages.isEmpty {
                    Divider()

                    VStack(spacing: 8) {
                        ForEach(model.packages) { item in
                            HStack(spacing: 10) {
                                Image(systemName: "theatermasks")
                                    .foregroundStyle(.secondary)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.project.title)
                                        .fontWeight(.medium)
                                    Text("\(item.project.multimediaActionCount) média\(item.project.multimediaActionCount > 1 ? "s" : "") • \(item.project.cues.count) Cue\(item.project.cues.count > 1 ? "s" : "")")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }

                                Spacer()

                                Button {
                                    model.removePackage(item.id)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                }
                                .buttonStyle(.plain)
                                .foregroundStyle(.secondary)
                                .help("Retirer ce package")
                            }
                        }

                        if model.packages.count > 1 {
                            HStack {
                                Spacer()
                                Button("Tout retirer") {
                                    model.clearPackages()
                                }
                                .controlSize(.small)
                            }
                        }
                    }
                }
            }
            .padding(14)
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Circle()
                        .fill(workspaceStatusColor)
                        .frame(width: 10, height: 10)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("QLab")
                            .font(.headline)

                        if let w = model.workspace {
                            Text(w.name)
                                .fontWeight(.medium)

                            if let folder = w.projectFolder {
                                Text(folder.path)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Text(model.savedShows.count == 1 ? "1 conduite S2A Pilot associée" : "\(model.savedShows.count) conduites S2A Pilot associées")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            } else {
                                Text("Workspace non enregistré — import impossible")
                                    .font(.caption2)
                                    .foregroundStyle(.orange)
                            }
                        } else {
                            Text("Aucun workspace détecté")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Spacer()

                    Button {
                        model.refreshWorkspace()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .help("Actualiser le workspace QLab")
                    .disabled(model.isBusy)
                }

                Divider()

                HStack {
                    Button {
                        model.importIntoQLab()
                    } label: {
                        Label(model.packages.count > 1 ? "Importer les conduites" : "Importer dans QLab", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(model.packages.isEmpty || model.workspace?.projectFolder == nil || model.isBusy)

                    Button {
                        model.startVisualMonitor()
                        openWindow(id: "visual-monitor")
                    } label: {
                        Label("Visualiseur", systemImage: "rectangle.on.rectangle")
                    }
                    .controlSize(.large)
                    .disabled(model.savedShows.isEmpty)

                    Spacer()
                }
            }
            .padding(14)
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

            if let error = model.errorMessage {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
                    Text(error).font(.callout).textSelection(.enabled)
                    Spacer()
                    Button { model.errorMessage = nil } label: { Image(systemName: "xmark.circle.fill") }
                        .buttonStyle(.plain)
                        .foregroundStyle(.secondary)
                        .help("Masquer le message")
                }
                .padding(12)
                .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(18)
        .frame(width: 640)
        .onAppear {
            model.refreshWorkspace()
        }
    }
}
struct VisualMonitorView: View {
    @ObservedObject var model: AppModel
    @State private var window: NSWindow?

    private func shortTime(_ seconds: Double) -> String {
        let total = max(0, Int(ceil(seconds)))

        if total >= 60 {
            return String(format: "%d:%02d", total / 60, total % 60)
        }

        return "\(total) s"
    }

    private func applyWindowLevel() {
        guard let window else { return }
        window.level = model.visualAlwaysOnTop ? .floating : .normal
        window.collectionBehavior = [.fullScreenAuxiliary]
    }

    var body: some View {
        VStack(spacing: 14) {
            HStack(spacing: 10) {
                Circle()
                    .fill(model.visualRunning ? Color.green : Color.orange)
                    .frame(width: 9, height: 9)

                VStack(alignment: .leading, spacing: 1) {
                    Text(model.activeShow?.title ?? "S2A Pilot")
                        .font(.headline)
                    Text(model.visualStatus)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Toggle("Toujours au premier plan", isOn: $model.visualAlwaysOnTop)
                    .toggleStyle(.switch)
                    .controlSize(.small)
                    .onChange(of: model.visualAlwaysOnTop) { _ in
                        applyWindowLevel()
                    }
            }

            Divider()

            if let cue = model.nextVisualCue {
                HStack(alignment: .top, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("PROCHAINE CUE")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)

                        Text(cue.name)
                            .font(.system(size: 20, weight: .semibold))
                            .lineLimit(3)

                        if let countdown = model.nextVisualCountdown {
                            Text("dans \(shortTime(countdown))")
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(countdown <= 10.0 ? Color.red : Color.primary)
                        }

                        Text("Cue à \(cue.timeText)")
                            .font(.callout)
                            .foregroundStyle(.secondary)

                        Spacer()
                    }
                    .frame(width: 205, alignment: .leading)

                    ZStack {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(.quaternary.opacity(0.5))

                        if let imageURL = model.nextVisualImageURL,
                           let image = NSImage(contentsOf: imageURL) {
                            Image(nsImage: image)
                                .resizable()
                                .scaledToFit()
                                .padding(10)
                        } else {
                            VStack(spacing: 8) {
                                Image(systemName: "photo")
                                    .font(.system(size: 34))
                                    .foregroundStyle(.secondary)
                                Text("Aucun visuel")
                                    .font(.callout)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .frame(minWidth: 245, minHeight: 170)
                }
            } else {
                VStack(spacing: 10) {
                    Image(systemName: model.activeShow == nil ? "pause.circle" : "checkmark.circle")
                        .font(.system(size: 42))
                        .foregroundStyle(.secondary)

                    Text(model.activeShow == nil ? "En attente d’un numéro S2A Pilot" : "Fin de conduite")
                        .font(.title3)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(30)
            }
        }
        .padding(16)
        .frame(minWidth: 525, minHeight: 285)
        .background(WindowAccessor { win in
            window = win
            applyWindowLevel()
        })
        .onAppear {
            model.startVisualMonitor()
            applyWindowLevel()
        }
    }
}

struct WindowAccessor: NSViewRepresentable {
    let callback: (NSWindow?) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            callback(view.window)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            callback(nsView.window)
        }
    }
}
@main
struct ShowCueForQLabApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
        }
        .windowResizability(.contentSize)

        WindowGroup("Visualiseur S2A Copilote", id: "visual-monitor") {
            VisualMonitorView(model: model)
        }
        .defaultSize(width: 565, height: 330)
    }
}
