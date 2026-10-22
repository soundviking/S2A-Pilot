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

        var monitorDescription: String? {
            guard let text = description?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
            return text
        }

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

struct SavedShowCue: Codable, Identifiable {
    let groupID: String
    let mediaID: String?
    let audioID: String? // Compatibilité avec les index créés avant la prise en charge vidéo.
    let title: String
    let cues: [ShowCueProject.Cue]
    let imagePaths: [String: String]
    let importedAt: Date
    var showDuration: Double? = nil
    var clockID: String? = nil
    var id: String { groupID }
}

struct SavedShowCueIndex: Codable {
    var version: Int = 1
    var shows: [SavedShowCue]
}

enum ShowCueError: LocalizedError, BridgeLocalizedError {
    case invalidPackage(BridgeText)
    case commandFailed(BridgeText)

    var bridgeText: BridgeText {
        switch self {
        case .invalidPackage(let message), .commandFailed(let message): return message
        }
    }
    var errorDescription: String? { bridgeText.localized }

}

final class AppModel: ObservableObject {
    @Published var packages: [QueuedShowCuePackage] = []
    @Published var workspace: WorkspaceInfo?
    @Published var availableWorkspaces: [WorkspaceInfo] = []
    var selectedWorkspaceID: String {
        get { workspace?.id ?? "" }
        set { selectWorkspace(newValue) }
    }
    @Published var status = BridgeText("Choisis un package S2A Pilot.")
    @Published var isBusy = false
    @Published var errorMessage: BridgeText?

    @Published var savedShows: [SavedShowCue] = []
    @Published var activeShow: SavedShowCue?
    @Published var visualElapsed: Double = 0
    @Published var visualRunning = false
    @Published var visualStatus = BridgeText("En attente d’un numéro S2A Pilot")
    @Published var visualAlwaysOnTop = true
    @Published var runtimeSnapshot: BridgeRuntimeSnapshot?
    @Published var currentRuntimeID: String?
    @Published var synchronizationLost = false
    @Published var selectedBridgeID: String?
    private let runtimeQueue = DispatchQueue(label: "fr.s2a.bridge.runtime", qos: .utility)
    private var selectionRevision = 0

    private var workspaceTimer: Timer?
    private var workspaceRefreshInFlight = false
    private var lastDetectionError: BridgeText?
    private var monitorTimer: Timer?
    private var monitorPollInFlight = false
    private var monitorGeneration = 0
    private var lastRuntimeSuccess = Date()

    private var extractedURL: URL?

    deinit {
        workspaceTimer?.invalidate()
        monitorTimer?.invalidate()
        for item in packages {
            try? FileManager.default.removeItem(at: item.extractedURL)
        }
        cleanup()
    }

    func choosePackage() {
        let panel = NSOpenPanel()
        panel.title = L("Choisir un ou plusieurs packages S2A Pilot")
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
        status = BridgeText("Lecture de {count} package(s)…", ["count": String(urls.count)])

        DispatchQueue.global(qos: .userInitiated).async {
            var loaded: [QueuedShowCuePackage] = []
            var failures: [BridgeText] = []

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
                    failures.append(BridgeText(joining: [BridgeText(raw: url.lastPathComponent + " : "), BridgeText(error:error)]))
                }
            }

            DispatchQueue.main.async {
                self.packages.append(contentsOf: loaded)
                self.isBusy = false

                if failures.isEmpty {
                    self.status = BridgeText("{count} package(s) chargé(s).", ["count": String(loaded.count)])
                } else {
                    self.status = BridgeText("{count} chargé(s), {failed} échec(s).", ["count": String(loaded.count), "failed": String(failures.count)])
                    self.errorMessage = BridgeText(joining: failures, separator: "\n")
                }

                self.refreshWorkspace()
            }
        }
    }

    func removePackage(_ id: UUID) {
        guard let index = packages.firstIndex(where: { $0.id == id }) else { return }
        let item = packages.remove(at: index)
        try? FileManager.default.removeItem(at: item.extractedURL)
        status = packages.isEmpty ? BridgeText("Choisis un ou plusieurs packages S2A Pilot.") : BridgeText("{count} package(s) prêt(s) à importer.", ["count": String(packages.count)])
    }

    func clearPackages() {
        for item in packages {
            try? FileManager.default.removeItem(at: item.extractedURL)
        }
        packages.removeAll()
        status = BridgeText("Choisis un ou plusieurs packages S2A Pilot.")
    }

    func loadPackage(_ url: URL) {
        loadPackages([url])
    }

    func startWorkspaceDetection() {
        guard workspaceTimer == nil else { return }
        refreshWorkspace()
        workspaceTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            self?.refreshWorkspace()
        }
        if let workspaceTimer { RunLoop.main.add(workspaceTimer, forMode: .common) }
    }

    func selectWorkspace(_ id: String) {
        guard !isBusy, let info = availableWorkspaces.first(where: { $0.id == id }), info != workspace else { return }
        stopVisualMonitor()
        workspace = info
        runtimeSnapshot = nil
        currentRuntimeID = nil
        selectedBridgeID = nil
        activeShow = nil
        visualRunning = false
        visualElapsed = 0
        loadSavedShows(for: info)
        startVisualMonitor()
    }

    func refreshWorkspace() {
        guard !workspaceRefreshInFlight, !isBusy else { return }
        workspaceRefreshInFlight = true
        let selectionID = workspace?.id
        DispatchQueue.global(qos: .utility).async {
            let result = Result { () throws -> ([WorkspaceInfo], WorkspaceInfo?, [SavedShowCue]) in
                let infos = try self.qlabWorkspaces()
                let selected = infos.first(where: { $0.id == selectionID }) ?? infos.first
                let shows = try selected.map { try self.liveSavedShows(for: $0) } ?? []
                return (infos, selected, shows)
            }
            DispatchQueue.main.async {
                self.workspaceRefreshInFlight = false
                guard !self.isBusy else { return }
                guard self.workspace?.id == selectionID else { self.refreshWorkspace(); return }
                switch result {
                case .success(let (infos, selected, shows)):
                    self.availableWorkspaces = infos
                    if selected != self.workspace {
                        self.stopVisualMonitor()
                        self.workspace = selected
                        self.runtimeSnapshot = nil
                        self.currentRuntimeID = nil
                        self.selectedBridgeID = nil
                        self.activeShow = nil
                        self.visualRunning = false
                        self.visualElapsed = 0
                        self.savedShows = []
                    }
                    if Set(self.savedShows.map { $0.groupID }) != Set(shows.map { $0.groupID }) {
                        self.stopVisualMonitor()
                    }
                    self.savedShows = shows
                    if let active = self.activeShow, !shows.contains(where: { $0.groupID == active.groupID }) {
                        self.activeShow = nil
                        self.visualRunning = false
                        self.visualElapsed = 0
                    }
                    if selected != nil && self.monitorTimer == nil { self.startVisualMonitor() }
                    if selected == nil {
                        self.synchronizationLost = self.runtimeSnapshot != nil
                        self.visualStatus = BridgeText(self.synchronizationLost ? "Synchronisation perdue" : "En attente d’un numéro S2A Pilot")
                        self.stopVisualMonitor(); self.runtimeSnapshot = nil; self.currentRuntimeID = nil
                    }
                    if self.errorMessage == self.lastDetectionError { self.errorMessage = nil }
                    self.lastDetectionError = nil
                case .failure(let error):
                    self.synchronizationLost = true
                    self.visualStatus = BridgeText("Synchronisation perdue")
                    self.availableWorkspaces = []
                    self.workspace = nil
                    self.savedShows = []
                    self.activeShow = nil
                    self.visualRunning = false
                    self.stopVisualMonitor()
                    // No workspace is a normal state. Only genuine access/script errors reach this branch.
                    let message = BridgeText(joining: [BridgeText("Impossible de détecter les workspaces QLab : "), BridgeText(error:error)])
                    if self.lastDetectionError != message { self.errorMessage = message }
                    self.lastDetectionError = message
                }
            }
        }
    }

    func importIntoQLab() {
        guard !packages.isEmpty, let selectedWorkspace = workspace else { return }

        isBusy = true
        errorMessage = nil
        status = BridgeText("Vérification de QLab…")

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let initial = try self.qlabWorkspace(id: selectedWorkspace.id)

                DispatchQueue.main.async {
                    let names = self.packages.map { "• \($0.project.title)" }.joined(separator: "\n")

                    let alert = NSAlert()
                    alert.messageText = self.packages.count == 1
                        ? L("Importer « {title} » ?", ["title": self.packages[0].project.title])
                        : L("Importer {count} conduites S2A Pilot ?", ["count": String(self.packages.count)])
                    alert.informativeText = L("Workspace QLab :") + "\n" + initial.name + "\n\n" + names + "\n\n" + L("Chaque numéro sera créé dans son propre Group cue Timeline.")
                    alert.addButton(withTitle: L("Importer"))
                    alert.addButton(withTitle: L("Annuler"))
                    alert.alertStyle = .informational

                    guard alert.runModal() == .alertFirstButtonReturn else {
                        self.isBusy = false
                        self.status = BridgeText("Import annulé.")
                        return
                    }

                    let queueSnapshot = self.packages

                    DispatchQueue.global(qos: .userInitiated).async {
                        do {
                            var current = try self.qlabWorkspace(id: initial.id)
                            guard current.id == initial.id else {
                                throw ShowCueError.commandFailed(BridgeText("Le workspace QLab sélectionné a été fermé. Import annulé."))
                            }

                            var importedCount = 0

                            for item in queueSnapshot {
                                current = try self.qlabWorkspace(id: initial.id)
                                guard current.id == initial.id else {
                                    throw ShowCueError.commandFailed(BridgeText("Le workspace QLab sélectionné a été fermé pendant l’import."))
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
                                    clockID: result.clockID,
                                    imageURLs: result.imageURLs,
                                    workspace: current
                                )
                                try self.saveShowRecord(record, for: current)
                                importedCount += 1
                                DispatchQueue.main.sync { self.removePackage(item.id) }
                            }

                            DispatchQueue.main.async {
                                self.isBusy = false
                                self.workspace = current
                                self.loadSavedShows(for: current)
                                self.visualElapsed = 0
                                self.visualRunning = false
                                self.visualStatus = BridgeText("En attente d’un numéro S2A Pilot")
                                self.startVisualMonitor()
                                self.status = BridgeText("{count} conduite(s) importée(s) dans « {workspace} ».", ["count": String(importedCount), "workspace": current.name])
                            }
                        } catch {
                            DispatchQueue.main.async {
                                self.isBusy = false
                                self.errorMessage = BridgeText(error:error)
                                self.status = BridgeText("Échec de l’import.")
                            }
                        }
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.isBusy = false
                    self.errorMessage = BridgeText(error:error)
                    self.status = BridgeText("Impossible de détecter QLab.")
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
            throw ShowCueError.invalidPackage(BridgeText("S2A Pilot Bridge attend un fichier .s2apilot.zip, .showcue.zip ou .zip."))
        }
        try run("/usr/bin/ditto", ["-x", "-k", url.path, temp.path])

        let manifest = temp.appendingPathComponent("conduite.json")
        guard fm.fileExists(atPath: manifest.path) else {
            throw ShowCueError.invalidPackage(BridgeText("conduite.json est introuvable dans le package."))
        }

        let data = try Data(contentsOf: manifest)
        let project = try JSONDecoder().decode(ShowCueProject.self, from: data)
        let acceptedFormats = ["showcue-multimedia-package", "show-cue-prep-package"]
        guard acceptedFormats.contains(project.format) || project.version >= 4 else {
            throw ShowCueError.invalidPackage(BridgeText("Format de package S2A Pilot non reconnu."))
        }

        let root = temp.standardizedFileURL.path + "/"
        if project.isMultimedia {
            for cue in project.cues {
                for action in cue.mediaActions ?? [] where !action.isStopAll {
                    guard let path = action.path, !path.isEmpty else {
                        throw ShowCueError.invalidPackage(BridgeText("Un média de la Cue {index} n’a pas de chemin dans le package.", ["index": String(cue.index)]))
                    }
                    let fileURL = temp.appendingPathComponent(path).standardizedFileURL
                    guard fileURL.path.hasPrefix(root), fm.fileExists(atPath: fileURL.path) else {
                        throw ShowCueError.invalidPackage(BridgeText(joining: [BridgeText("Média introuvable : "), BridgeText(raw:path)]))
                    }
                }
            }
        } else if let resolved = project.resolvedLegacyMedia {
            let fileURL = temp.appendingPathComponent(resolved.media.path).standardizedFileURL
            guard fileURL.path.hasPrefix(root), fm.fileExists(atPath: fileURL.path) else {
                throw ShowCueError.invalidPackage(BridgeText(joining: [BridgeText("Le média principal est introuvable : "), BridgeText(raw:resolved.media.path)]))
            }
        } else {
            throw ShowCueError.invalidPackage(BridgeText("Le package ne contient aucun média exploitable."))
        }

        return (temp, project)
    }

    private func qlabWorkspaces(id: String? = nil) throws -> [WorkspaceInfo] {
        let output = try run("/usr/bin/osascript", ["-e", BridgeWorkspaceQuery.script(id: id)],timeout:8)
        do {
            return try BridgeWorkspaceQuery.parse(output)
        } catch {
            throw ShowCueError.commandFailed(BridgeText("La réponse de QLab est incomplète. Actualise la connexion puis réessaie."))
        }
    }

    private func qlabWorkspace(id: String) throws -> WorkspaceInfo {
        do {
            return try BridgeWorkspaceQuery.resolve(id: id) { try qlabWorkspaces(id: $0) }
        } catch BridgeWorkspaceQuery.QueryError.workspaceClosed {
            throw ShowCueError.commandFailed(BridgeText("Le workspace sélectionné a été fermé. Choisis un workspace ouvert."))
        }
    }

    private func performImport(project: ShowCueProject, folder: URL, workspaceID: String) throws -> (groupID: String, mediaID: String?, clockID: String?, imageURLs: [Int: URL]) {
        let current = try qlabWorkspace(id: workspaceID)
        guard current.id == workspaceID else { throw ShowCueError.commandFailed(BridgeText("Le workspace QLab sélectionné a été fermé.")) }
        guard let projectFolder = current.projectFolder else { throw ShowCueError.commandFailed(BridgeText("Le workspace QLab doit être enregistré avant l’import.")) }

        let fm = FileManager.default
        let packageRoot = folder.standardizedFileURL.path + "/"
        let importFolderName = safeFileName(project.title) + "-" + UUID().uuidString
        let mediaFolder = projectFolder.appendingPathComponent("S2A Pilot Media", isDirectory: true).appendingPathComponent(importFolderName, isDirectory: true)
        let imageFolder = projectFolder.appendingPathComponent("images", isDirectory: true).appendingPathComponent(importFolderName, isDirectory: true)
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
                        throw ShowCueError.invalidPackage(BridgeText(joining: [BridgeText("Média introuvable : "), BridgeText(raw:path)]))
                    }
                    let key = action.id ?? "cue\(cue.index)-\(offset)"
                    if destinationForAction[key] == nil {
                        let name = safeFileName(action.name ?? source.lastPathComponent)
                        let destination = mediaFolder.appendingPathComponent(String(format: "%02d-", cue.index) + safeFileName(key) + "-" + name)
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
        lines.append("if (count of workspaces) is 0 then error \(asAppleString(L("Aucun workspace QLab n’est ouvert.")))")
        lines.append("set targetWorkspace to first workspace whose unique id is \(asAppleString(workspaceID))")
        lines.append("if (unique id of targetWorkspace) is not \(asAppleString(workspaceID)) then error \(asAppleString(L("Le workspace QLab sélectionné a été fermé.")))")
        lines.append("set showGroup to my s2aMakeCue(targetWorkspace, \"Group\")")
        lines.append("set q name of showGroup to \(asAppleString(project.title))")
        lines.append("set mode of showGroup to timeline")
        lines.append("set importedGroupNumber to q number of showGroup as text")

        var firstMediaVariable: String? = nil
        var mediaCounter = 0
        var utilityCounter = 0
        var priorAudioVariables: [String] = []
        var priorVideoVariables: [String] = []

        func qlabTime(_ value: Double) -> String { String(format: "%.3f", value) }
        func appendStop(target: String, at time: Double, label: String) {
            utilityCounter += 1
            let variable = "stopCue\(utilityCounter)"
            lines.append("set \(variable) to my s2aMakeCue(targetWorkspace, \(asAppleString("Stop")))")
            lines.append("set q name of \(variable) to \(asAppleString(label))")
            lines.append("set cue target of \(variable) to \(target)")
            lines.append("set pre wait of \(variable) to \(qlabTime(time))")
            lines.append("move \(variable) to end of showGroup")
        }
        func appendAudioFade(target: String, at time: Double, duration: Double, toDB: Double, stopWhenDone: Bool, label: String) {
            utilityCounter += 1
            let variable = "fadeCue\(utilityCounter)"
            lines.append("set \(variable) to my s2aMakeCue(targetWorkspace, \(asAppleString("Fade")))")
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
            lines.append("set \(variable) to my s2aMakeCue(targetWorkspace, \(asAppleString("Fade")))")
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

                for action in (cue.mediaActions ?? []).filter({ $0.isStopAll }) {
                    if action.transition == "fade" {
                        let d = action.fadeSeconds
                        for target in priorAudioVariables {
                            appendAudioFade(target: target, at: cue.time, duration: d, toDB: -120, stopWhenDone: true, label: L("FONDU GLOBAL — AUDIO"))
                        }
                        for target in priorVideoVariables {
                            appendVideoFade(target: target, at: cue.time, duration: d, stopWhenDone: true, label: L("FONDU GLOBAL — VIDÉO"))
                        }
                    } else {
                        for target in priorAudioVariables {
                            appendStop(target: target, at: cue.time, label: L("STOP GLOBAL — AUDIO"))
                        }
                        for target in priorVideoVariables {
                            appendStop(target: target, at: cue.time, label: L("STOP GLOBAL — VIDÉO"))
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
                    let prefix = action.isVideo ? L("VIDÉO") : "AUDIO"
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
                        for target in priorVideoVariables { appendStop(target: target, at: cue.time, label: L("CUT VIDÉO — ") + cue.name) }
                        priorVideoVariables.removeAll()
                    }

                    lines.append("set \(variable) to my s2aMakeCue(targetWorkspace, \(asAppleString(cueType)))")
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
                        appendAudioFade(target: variable, at: cue.time, duration: action.fadeSeconds, toDB: 0, stopWhenDone: false, label: L("FONDU ENTRÉE — ") + cue.name)
                    }
                    if action.isAudio { priorAudioVariables.append(variable) }
                    if action.isVideo { priorVideoVariables.append(variable) }
                }
            }

        } else if let legacy = project.resolvedLegacyMedia, let destination = destinationForAction["legacy"] {
            let cueType = legacy.kind == "video" ? "Video" : "Audio"
            lines.append("set legacyCue to my s2aMakeCue(targetWorkspace, \(asAppleString(cueType)))")
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
        }

        // One explicit QLab clock spans silent passages; visual repères stay in Bridge.
        lines.append("set showClock to my s2aMakeCue(targetWorkspace, \(asAppleString("Wait")))")
        lines.append("set continue mode of showClock to do_not_continue")
        lines.append("set q name of showClock to \(asAppleString("S2A PILOT — HORLOGE DE CONDUITE"))")
        lines.append("set pre wait of showClock to 0")
        lines.append("set post wait of showClock to \(qlabTime(project.resolvedShowDuration))")
        lines.append("move showClock to end of showGroup")

        lines.append("set importedChildren to cues of showGroup as list")
        lines.append("repeat with importedChild in importedChildren")
        lines.append("set q number of importedChild to \"\"")
        lines.append("end repeat")
        lines.append("set usedNumbers to q number of cues of targetWorkspace")
        lines.append("set groupNumber to my s2aGroupNumber(importedGroupNumber, usedNumbers)")
        lines.append("set q number of showGroup to groupNumber")
        lines.append("set end of usedNumbers to groupNumber")
        lines.append("set childNumbers to my s2aChildNumbers(groupNumber, usedNumbers, count of importedChildren)")
        lines.append("repeat with childIndex from 1 to count of importedChildren")
        lines.append("set q number of item childIndex of importedChildren to item childIndex of childNumbers")
        lines.append("end repeat")
        lines.append("set selected of targetWorkspace to {showGroup}")

        if let firstMediaVariable {
            lines.append("return (uniqueID of showGroup as text) & tab & (uniqueID of \(firstMediaVariable) as text) & tab & (uniqueID of showClock as text)")
        } else {
            lines.append("return (uniqueID of showGroup as text) & tab & \"\" & tab & (uniqueID of showClock as text)")
        }
        lines.append("end tell")
        lines.append("""
        on s2aMakeCue(w, cueType)
            tell application id "com.figure53.QLab.5"
                set beforeIDs to uniqueID of cues of w
                make w type cueType
                set afterIDs to uniqueID of cues of w
                set newIDs to {}
                repeat with candidateID in afterIDs
                    set candidateText to contents of candidateID as text
                    if beforeIDs does not contain candidateText then set end of newIDs to candidateText
                end repeat
                if (count of newIDs) is not 1 then error "QLab did not confirm one newly created cue."
                return cue id (first item of newIDs) of w
            end tell
        end s2aMakeCue
        """)
        lines.append("on s2aGroupNumber(currentNumber, usedNumbers)\n    if currentNumber is not \"\" then return currentNumber\n    set candidate to 1\n    repeat while usedNumbers contains (candidate as text)\n        set candidate to candidate + 1\n    end repeat\n    return candidate as text\nend s2aGroupNumber\n\non s2aChildNumbers(groupNumber, usedNumbers, childCount)\n    set resultNumbers to {}\n    set stepIndex to 1\n    repeat childCount times\n        set candidate to groupNumber & \".\" & (stepIndex as text)\n        repeat while usedNumbers contains candidate\n            set stepIndex to stepIndex + 1\n            set candidate to groupNumber & \".\" & (stepIndex as text)\n        end repeat\n        set end of resultNumbers to candidate\n        set end of usedNumbers to candidate\n        set stepIndex to stepIndex + 1\n    end repeat\n    return resultNumbers\nend s2aChildNumbers")

        let output = try run("/usr/bin/osascript", ["-e", lines.joined(separator: "\n")])
        let ids = output.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
        guard let groupID = ids.first, !groupID.isEmpty else { throw ShowCueError.commandFailed(BridgeText("QLab n’a pas renvoyé l’identifiant du Group cue importé.")) }
        let mediaID = ids.count > 1 && !ids[1].isEmpty ? ids[1] : nil
        return (groupID, project.isMultimedia ? nil : mediaID, ids.count > 2 ? ids[2] : nil, imageDestinations)
    }

    private func showCueDirectory(for workspace: WorkspaceInfo) throws -> URL {
        guard let projectFolder = workspace.projectFolder else {
            throw ShowCueError.commandFailed(BridgeText("Le workspace QLab doit être enregistré."))
        }
        return projectFolder.appendingPathComponent("S2A Pilot", isDirectory: true)
    }

    private func indexURL(for workspace: WorkspaceInfo) throws -> URL {
        try showCueDirectory(for: workspace).appendingPathComponent("index-" + safeFileName(workspace.id) + ".json")
    }

    private func makeSavedShowRecord(project: ShowCueProject, groupID: String, mediaID: String?, clockID: String?, imageURLs: [Int: URL], workspace: WorkspaceInfo) throws -> SavedShowCue {
        guard let projectFolder = workspace.projectFolder else {
            throw ShowCueError.commandFailed(BridgeText("Le workspace QLab doit être enregistré."))
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
        return SavedShowCue(groupID: groupID, mediaID: mediaID, audioID: project.resolvedLegacyMedia?.kind == "audio" ? mediaID : nil, title: project.title, cues: project.cues.sorted(by: { $0.time < $1.time }), imagePaths: relativeImages, importedAt: Date(), showDuration: project.resolvedShowDuration, clockID: clockID)
    }

    private func loadIndexData(for workspace: WorkspaceInfo) throws -> SavedShowCueIndex {
        let currentURL = try indexURL(for: workspace)
        let legacyURL = try showCueDirectory(for: workspace).appendingPathComponent("index.json")
        let url = FileManager.default.fileExists(atPath: currentURL.path) ? currentURL : legacyURL
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

    // The index is metadata, not proof that an imported group still exists.
    // Keep it intact: a saved workspace or Undo can restore a missing group.
    private func liveSavedShows(for workspace: WorkspaceInfo) throws -> [SavedShowCue] {
        guard workspace.projectFolder != nil else { return [] }
        let records = try loadIndexData(for: workspace).shows
        guard !records.isEmpty else { return [] }
        var lines = ["tell application id \"com.figure53.QLab.5\"",
                     "set matches to (workspaces whose unique id is \(asAppleString(workspace.id)))",
                     "if (count of matches) is 0 then error \(self.asAppleString(L("Le workspace a été fermé pendant la synchronisation.")))",
                     "set w to first item of matches", "set resultText to \"\""]
        for record in records {
            lines.append("if exists (cue id \(asAppleString(record.groupID)) of w) then")
            lines.append("set resultText to resultText & \(asAppleString(record.groupID)) & linefeed")
            lines.append("end if")
        }
        lines.append("return resultText")
        lines.append("end tell")
        let output = try run("/usr/bin/osascript", ["-e", lines.joined(separator: "\n")])
        let liveIDs = Set(output.split(separator: "\n").map(String.init))
        return records.filter { liveIDs.contains($0.groupID) }.sorted { $0.importedAt < $1.importedAt }
    }

    private func loadSavedShows(for workspace: WorkspaceInfo) {
        savedShows = []
        activeShow = nil
        refreshWorkspace()
    }

    private func saveShowRecord(_ record: SavedShowCue, for workspace: WorkspaceInfo) throws {
        var index = try loadIndexData(for: workspace)
        index.shows.removeAll(where: { $0.groupID == record.groupID })
        index.shows.append(record)
        try writeIndexData(index, for: workspace)
    }

    func startVisualMonitor() {
        stopVisualMonitor()
        guard workspace != nil else { return }
        lastRuntimeSuccess = Date()
        monitorTimer = Timer.scheduledTimer(withTimeInterval:0.25,repeats:true) { [weak self] _ in
            guard let self else { return }
            if Date().timeIntervalSince(self.lastRuntimeSuccess) > 2 {
                self.synchronizationLost = true; self.visualRunning = false
                self.visualStatus = BridgeText("Synchronisation perdue")
            }
            self.pollVisualMonitor()
        }
        if let monitorTimer { RunLoop.main.add(monitorTimer, forMode: .common) }
        pollVisualMonitor()
    }

    func stopVisualMonitor() {
        monitorGeneration += 1
        monitorTimer?.invalidate()
        monitorTimer = nil
        monitorPollInFlight = false
    }

    private func pollVisualMonitor() {
        guard !monitorPollInFlight, let workspace else { return }
        monitorPollInFlight = true
        let generation = monitorGeneration
        let showsSnapshot = savedShows
        let selectionRevision = selectionRevision
        runtimeQueue.async {
            let result = Result { () throws -> BridgeRuntimeSnapshot in
                let script = BridgeRuntimeSnapshot.script(workspaceID:workspace.id,shows:showsSnapshot)
                return try BridgeRuntimeSnapshot.parse(self.run("/usr/bin/osascript",["-e",script],timeout:8))
            }
            DispatchQueue.main.async {
                guard self.monitorGeneration == generation, self.workspace?.id == workspace.id else { return }
                self.monitorPollInFlight = false
                guard self.selectionRevision == selectionRevision else { return }
                switch result {
                case .success(let snapshot):
                    self.lastRuntimeSuccess = Date()
                    self.synchronizationLost = false
                    let previous = self.runtimeSnapshot
                    let newlyStarted = snapshot.roots.last(where: { cue in
                        cue.running && !cue.paused && previous?.roots.first(where:{$0.id == cue.id}).map({ !$0.running || $0.paused }) == true
                    })
                    let selected = newlyStarted ?? snapshot.current(previousID:self.currentRuntimeID)
                    self.runtimeSnapshot = snapshot
                    self.selectedBridgeID = snapshot.selectedID.isEmpty ? nil : snapshot.selectedID
                    self.currentRuntimeID = selected?.id
                    self.activeShow = showsSnapshot.first(where:{$0.groupID == (selected?.id ?? snapshot.standbyID)})
                    let clock = selected.flatMap { snapshot.clocks[$0.id] } ?? selected
                    self.visualElapsed = clock?.elapsed ?? 0
                    self.visualRunning = clock.map { $0.running && !$0.paused } ?? false
                    self.visualStatus = BridgeText(clock?.paused == true ? "Pause" : clock?.running == true ? "Lecture" : "En attente d’un numéro S2A Pilot")
                case .failure:
                    // Freeze the last confirmed position and make the loss explicit.
                    self.synchronizationLost = true
                    self.visualRunning = false
                    self.visualStatus = BridgeText("Synchronisation perdue")
                }
            }
        }
    }

    // Only explicit interaction writes selection; polling never calls this method.
    func selectBridgeCue(_ id: String) {
        guard let workspace, !synchronizationLost,
              runtimeSnapshot?.roots.contains(where: { $0.id == id }) == true,
              selectedBridgeID != id else { return }
        selectionRevision += 1
        let revision = selectionRevision
        let generation = monitorGeneration
        selectedBridgeID = id
        runtimeQueue.async {
            let valid = DispatchQueue.main.sync {
                self.monitorGeneration == generation && self.selectionRevision == revision && self.workspace?.id == workspace.id
            }
            guard valid else { return }
            let result = Result {
                try self.run("/usr/bin/osascript", ["-e", BridgeRuntimeSnapshot.selectionScript(workspace: workspace.id, cue: id)], timeout: 8)
            }
            DispatchQueue.main.async {
                guard self.monitorGeneration == generation, self.selectionRevision == revision else { return }
                if case .failure(let error) = result {
                    self.selectedBridgeID = nil
                    self.errorMessage = BridgeText(error: error)
                }
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
    private func run(_ executable: String, _ arguments: [String], stdin: String? = nil, timeout: Double = 120) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments

        // Drain output to temporary files: large QLab replies must not fill a pipe
        // while the parent waits for osascript to exit.
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("S2ABridge-command-"+UUID().uuidString)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        defer { try? FileManager.default.removeItem(at:directory) }
        let outURL = directory.appendingPathComponent("stdout"), errURL = directory.appendingPathComponent("stderr")
        FileManager.default.createFile(atPath:outURL.path,contents:nil)
        FileManager.default.createFile(atPath:errURL.path,contents:nil)
        let out = try FileHandle(forWritingTo:outURL), err = try FileHandle(forWritingTo:errURL)
        defer { try? out.close(); try? err.close() }
        process.standardOutput = out
        process.standardError = err
        let finished = DispatchSemaphore(value:0)
        process.terminationHandler = { _ in finished.signal() }
        if let stdin {
            let input = Pipe()
            process.standardInput = input
            try process.run()
            input.fileHandleForWriting.write(stdin.data(using:.utf8)!)
            input.fileHandleForWriting.closeFile()
        } else { try process.run() }
        if finished.wait(timeout:.now()+timeout) == .timedOut {
            process.terminate()
            if finished.wait(timeout:.now()+1) == .timedOut { kill(process.processIdentifier,SIGKILL); process.waitUntilExit() }
            throw ShowCueError.commandFailed(BridgeText("QLab ne répond pas. Vérifie ses fenêtres de dialogue puis réessaie."))
        }
        let stdout = String(data:try Data(contentsOf:outURL),encoding:.utf8) ?? ""
        let stderr = String(data:try Data(contentsOf:errURL),encoding:.utf8) ?? ""
        guard process.terminationStatus == 0 else {
            throw ShowCueError.commandFailed(BridgeText(raw:stderr.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty ? stdout : stderr))
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
    @AppStorage("s2a-language") private var interfaceLanguage = defaultInterfaceLanguage
        @Environment(\.openWindow) private var openWindow

    private var workspaceStatusColor: Color {
        if model.workspace?.projectFolder != nil { return .green }
        if model.workspace != nil { return .orange }
        return .red
    }

    var body: some View {
        VStack(spacing: 18) {
            HStack(alignment: .center, spacing: 12) {
                if let icon = NSImage(named: NSImage.Name("S2APilotBridgeIcon")) {
                    Image(nsImage: icon).resizable().scaledToFit().frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text("S2A Pilot Bridge")
                        .font(.system(size: 20, weight: .semibold))
                    Text(L("Import de conduites S2A Pilot V5 dans QLab 5"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()
                Picker(L("Langue"), selection: $interfaceLanguage) {
                    Text("Français").tag("fr")
                    Text("English").tag("en")
                    Text("Español").tag("es")
                    Text("Deutsch").tag("de")
                }.pickerStyle(.menu).labelsHidden().accessibilityLabel(L("Langue")).frame(width: 125).disabled(model.isBusy)
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
                        Text(L("Package S2A Pilot"))
                            .font(.headline)
                        Text(model.packages.isEmpty ? L("Aucun package sélectionné") : L("{count} package(s) sélectionné(s)", ["count": String(model.packages.count)]))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }

                    Spacer()


                    Button(L("Ajouter…")) {
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
                                    Text(L("{media} média(s) • {cues} Cues", ["media": String(item.project.multimediaActionCount), "cues": String(item.project.cues.count)]))
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
                                .help(L("Retirer ce package"))
                            }
                        }

                        if model.packages.count > 1 {
                            HStack {
                                Spacer()
                                Button(L("Tout retirer")) {
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
                            if model.availableWorkspaces.count > 1 {
                                Picker("Workspace", selection: Binding(get: { model.selectedWorkspaceID }, set: { model.selectedWorkspaceID = $0 })) {
                                    ForEach(model.availableWorkspaces) { info in
                                        Text(info.name).tag(info.id)
                                    }
                                }
                                .pickerStyle(.menu)
                                .disabled(model.isBusy)
                            } else {
                                Text(w.name).fontWeight(.medium)
                            }

                            if let folder = w.projectFolder {
                                Text(folder.path)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Text(L("{count} conduites S2A Pilot associées", ["count": String(model.savedShows.count)]))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            } else {
                                Text(L("Workspace non enregistré — import impossible"))
                                    .font(.caption2)
                                    .foregroundStyle(.orange)
                            }
                        } else {
                            Text(L("Aucun workspace détecté"))
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
                    .help(L("Actualiser le workspace QLab"))
                    .disabled(model.isBusy)
                }

                Divider()

                HStack {
                    Button {
                        model.importIntoQLab()
                    } label: {
                        Label(model.packages.count > 1 ? L("Importer les conduites") : L("Importer dans QLab"), systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(model.packages.isEmpty || model.workspace?.projectFolder == nil || model.isBusy)

                    Button {
                        model.startVisualMonitor()
                        openWindow(id: "visual-monitor")
                    } label: {
                        Label("Show", systemImage: "rectangle.on.rectangle")
                    }
                    .controlSize(.large)
                    .disabled(model.workspace == nil || model.isBusy)

                    Spacer()
                }
            }
            .padding(14)
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

            if let error = model.errorMessage {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
                    Text(error.localized).font(.callout).textSelection(.enabled)
                    Spacer()
                    Button { model.errorMessage = nil } label: { Image(systemName: "xmark.circle.fill") }
                        .buttonStyle(.plain)
                        .foregroundStyle(.secondary)
                        .help(L("Masquer le message"))
                }
                .padding(12)
                .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(18)
        .frame(width: 640)
        .onAppear {
            model.startWorkspaceDetection()
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
// Bridge only needs the application menu and window management.
final class BridgeAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        scheduleMenuCleanup()
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        scheduleMenuCleanup()
    }

    private func scheduleMenuCleanup() {
        DispatchQueue.main.async {
            guard let menu = NSApp.mainMenu else { return }
            Self.simplify(menu, keepingWindowMenu: NSApp.windowsMenu)
            NSApp.helpMenu = nil
        }
    }

    static func simplify(_ menu: NSMenu, keepingWindowMenu windowMenu: NSMenu?) {
        guard let applicationItem = menu.items.first else { return }
        for item in menu.items where item !== applicationItem {
            if windowMenu == nil || item.submenu !== windowMenu {
                menu.removeItem(item)
            }
        }
    }
}

@main
struct ShowCueForQLabApp: App {
    @NSApplicationDelegateAdaptor(BridgeAppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
        }
        .windowResizability(.contentSize)

        WindowGroup(L("Visualiseur S2A Pilot Bridge"), id: "visual-monitor") {
            VisualMonitorView(model: model)
        }
        .defaultSize(width: 1360, height: 850)
    }
}
