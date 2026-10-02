import SwiftUI
import AppKit
import Foundation

struct ShowCueProject: Codable {
    struct Media: Codable {
        let fileName: String
        let originalFileName: String?
        let mimeType: String?
        let size: Int?
        let duration: Double?
        let path: String
        let mutedOutput: Bool?
    }

    struct Cue: Codable, Identifiable {
        let index: Int
        let time: Double
        let type: String
        let name: String
        let imagePath: String?

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
    let audio: Media?
    let video: Media?
    let primaryMedia: String?
    let cues: [Cue]

    var resolvedMedia: (kind: String, media: Media)? {
        if primaryMedia == "video", let video { return ("video", video) }
        if primaryMedia == "audio", let audio { return ("audio", audio) }
        if let audio { return ("audio", audio) }
        if let video { return ("video", video) }
        return nil
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
    @Published var status = "Choisis un package ShowCue."
    @Published var isBusy = false
    @Published var errorMessage: String?

    @Published var savedShows: [SavedShowCue] = []
    @Published var activeShow: SavedShowCue?
    @Published var visualElapsed: Double = 0
    @Published var visualRunning = false
    @Published var visualStatus = "En attente d’un numéro ShowCue"
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
        panel.title = "Choisir un ou plusieurs packages ShowCue"
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
        status = packages.isEmpty ? "Choisis un ou plusieurs packages ShowCue." : "\(packages.count) package\(packages.count > 1 ? "s" : "") prêt\(packages.count > 1 ? "s" : "") à importer."
    }

    func clearPackages() {
        for item in packages {
            try? FileManager.default.removeItem(at: item.extractedURL)
        }
        packages.removeAll()
        status = "Choisis un ou plusieurs packages ShowCue."
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
                        : "Importer \(self.packages.count) ShowCues ?"
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
                                self.visualStatus = "En attente d’un numéro ShowCue"
                                self.startVisualMonitor()
                                self.status = "\(importedCount) ShowCue\(importedCount > 1 ? "s" : "") importé\(importedCount > 1 ? "s" : "") dans « \(current.name) »."

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
        let temp = fm.temporaryDirectory
            .appendingPathComponent("ShowCue-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: temp, withIntermediateDirectories: true)

        let ext = url.pathExtension.lowercased()
        if ext == "zip" {
            try run("/usr/bin/ditto", ["-x", "-k", url.path, temp.path])
        } else if fm.fileExists(atPath: url.path, isDirectory: nil) {
            // Allow selecting an already-unzipped folder later if needed.
            throw ShowCueError.invalidPackage("Le prototype 0.1 attend un fichier .showcue.zip ou .zip.")
        }

        let manifest = temp.appendingPathComponent("conduite.json")
        guard fm.fileExists(atPath: manifest.path) else {
            throw ShowCueError.invalidPackage("conduite.json est introuvable dans le package.")
        }

        let data = try Data(contentsOf: manifest)
        let decoder = JSONDecoder()
        let project = try decoder.decode(ShowCueProject.self, from: data)

        guard project.format == "show-cue-prep-package" else {
            throw ShowCueError.invalidPackage("Format de package ShowCue non reconnu.")
        }
        guard let resolved = project.resolvedMedia else {
            throw ShowCueError.invalidPackage("Le package ne contient ni média audio ni média vidéo exploitable.")
        }
        let mediaURL = temp.appendingPathComponent(resolved.media.path).standardizedFileURL
        let tempRoot = temp.standardizedFileURL.path + "/"
        guard mediaURL.path.hasPrefix(tempRoot) else {
            throw ShowCueError.invalidPackage("Le chemin du média dans le package est invalide.")
        }
        guard fm.fileExists(atPath: mediaURL.path) else {
            throw ShowCueError.invalidPackage("Le fichier \(resolved.kind == "video" ? "vidéo" : "audio") du package est introuvable : \(resolved.media.path)")
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

    private func performImport(project: ShowCueProject, folder: URL, workspaceID: String) throws -> (groupID: String, mediaID: String, imageURLs: [Int: URL]) {
        let current = try qlabFrontWorkspace()
        guard current.id == workspaceID else {
            throw ShowCueError.commandFailed("Le workspace QLab au premier plan a changé.")
        }
        guard let projectFolder = current.projectFolder else {
            throw ShowCueError.commandFailed("Le workspace QLab doit être enregistré avant l’import.")
        }
        guard let resolved = project.resolvedMedia else {
            throw ShowCueError.invalidPackage("Le package ne contient aucun média principal exploitable.")
        }

        let fm = FileManager.default
        let mediaFolderName = resolved.kind == "video" ? "video" : "audio"
        let mediaFolder = projectFolder.appendingPathComponent(mediaFolderName, isDirectory: true)
        let imageFolder = projectFolder
            .appendingPathComponent("images", isDirectory: true)
            .appendingPathComponent(safeFileName(project.title), isDirectory: true)

        try fm.createDirectory(at: mediaFolder, withIntermediateDirectories: true)
        try fm.createDirectory(at: imageFolder, withIntermediateDirectories: true)

        let sourceMedia = folder.appendingPathComponent(resolved.media.path).standardizedFileURL
        let packageRoot = folder.standardizedFileURL.path + "/"
        guard sourceMedia.path.hasPrefix(packageRoot), fm.fileExists(atPath: sourceMedia.path) else {
            throw ShowCueError.invalidPackage("Le fichier média principal du package est introuvable ou son chemin est invalide.")
        }

        let mediaBaseName = safeFileName(resolved.media.originalFileName ?? resolved.media.fileName)
        let destinationMedia = mediaFolder.appendingPathComponent(
            safeFileName(project.title) + " - " + mediaBaseName
        )
        try copyReplacing(sourceMedia, to: destinationMedia)

        var imageDestinations: [Int: URL] = [:]
        for cue in project.cues {
            guard let imagePath = cue.imagePath, !imagePath.isEmpty else { continue }
            let sourceImage = folder.appendingPathComponent(imagePath).standardizedFileURL
            guard sourceImage.path.hasPrefix(packageRoot), fm.fileExists(atPath: sourceImage.path) else { continue }

            let imageName = safeFileName(sourceImage.lastPathComponent)
            let destinationImage = imageFolder.appendingPathComponent(imageName)
            try copyReplacing(sourceImage, to: destinationImage)
            imageDestinations[cue.index] = destinationImage
        }

        let qlabCueType = resolved.kind == "video" ? "Video" : "Audio"
        let cuePrefix = resolved.kind == "video" ? "VIDÉO" : "MUSIQUE"

        var lines: [String] = []
        lines.append("on run argv")
        lines.append("set mediaPath to item 1 of argv")
        lines.append("tell application id \"com.figure53.QLab.5\"")
        lines.append("if (count of workspaces) is 0 then error \"Aucun workspace QLab n’est ouvert.\"")
        lines.append("set targetWorkspace to front workspace")
        lines.append("if (unique id of targetWorkspace) is not \(asAppleString(workspaceID)) then error \"Le workspace QLab au premier plan a changé.\"")
        lines.append("make targetWorkspace type \"Group\"")
        lines.append("set showGroup to last item of (selected of targetWorkspace as list)")
        lines.append("set q name of showGroup to \(asAppleString(project.title))")
        lines.append("set mode of showGroup to start_first")
        lines.append("make targetWorkspace type \(asAppleString(qlabCueType))")
        lines.append("set mediaCue to last item of (selected of targetWorkspace as list)")
        lines.append("set q name of mediaCue to \(asAppleString("\(cuePrefix) — \(project.title)"))")
        lines.append("set file target of mediaCue to (POSIX file mediaPath as alias)")
        lines.append("set pre wait of mediaCue to 0")
        lines.append("move mediaCue to end of showGroup")

        for cue in project.cues.sorted(by: { $0.time < $1.time }) {
            lines.append("make targetWorkspace type \"Memo\"")
            lines.append("set memoCue to last item of (selected of targetWorkspace as list)")
            lines.append("set q name of memoCue to \(asAppleString(cue.qlabDisplayName))")
            lines.append("move memoCue to end of showGroup")
        }

        lines.append("return (uniqueID of showGroup as text) & tab & (uniqueID of mediaCue as text)")
        lines.append("end tell")
        lines.append("end run")

        let script = lines.joined(separator: "\n")
        let importIDs = try run("/usr/bin/osascript", ["-", destinationMedia.path], stdin: script)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: "\t", omittingEmptySubsequences: false)
            .map(String.init)

        guard importIDs.count >= 2, !importIDs[0].isEmpty, !importIDs[1].isEmpty else {
            throw ShowCueError.commandFailed("QLab n’a pas renvoyé les identifiants du Group cue et du média importé.")
        }

        return (importIDs[0], importIDs[1], imageDestinations)
    }

    private func showCueDirectory(for workspace: WorkspaceInfo) throws -> URL {
        guard let projectFolder = workspace.projectFolder else {
            throw ShowCueError.commandFailed("Le workspace QLab doit être enregistré.")
        }
        return projectFolder.appendingPathComponent("ShowCue", isDirectory: true)
    }

    private func indexURL(for workspace: WorkspaceInfo) throws -> URL {
        try showCueDirectory(for: workspace).appendingPathComponent("index.json")
    }

    private func makeSavedShowRecord(project: ShowCueProject, groupID: String, mediaID: String, imageURLs: [Int: URL], workspace: WorkspaceInfo) throws -> SavedShowCue {
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
        return SavedShowCue(groupID: groupID, mediaID: mediaID, audioID: project.resolvedMedia?.kind == "audio" ? mediaID : nil, title: project.title, cues: project.cues.sorted(by: { $0.time < $1.time }), imagePaths: relativeImages, importedAt: Date())
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
            errorMessage = "Impossible de lire l’index ShowCue : \(error.localizedDescription)"
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
            visualStatus = "En attente d’un numéro ShowCue"
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
                        self.activeShow=nil; self.visualRunning=false; self.visualElapsed=0; self.visualStatus="En attente d’un numéro ShowCue"; return
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
        return activeShow.cues.sorted(by:{$0.time < $1.time}).first(where:{$0.time >= visualElapsed - 0.02})
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
                    Text("ShowCue for QLab")
                        .font(.system(size: 20, weight: .semibold))
                    Text("Import de conduites dans QLab 5")
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
                        Text("Package ShowCue")
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
                                    Text("\(item.project.resolvedMedia?.media.originalFileName ?? item.project.resolvedMedia?.media.fileName ?? "Média inconnu") • \(item.project.cues.count) TOP\(item.project.cues.count > 1 ? "S" : "")")
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
                                Text(model.savedShows.count == 1 ? "1 ShowCue associé" : "\(model.savedShows.count) ShowCues associés")
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
                        Label(model.packages.count > 1 ? "Importer les ShowCues" : "Importer dans QLab", systemImage: "square.and.arrow.down")
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
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.callout)
                        .textSelection(.enabled)
                    Spacer()
                }
                .padding(12)
                .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle")
                        .foregroundStyle(.secondary)
                    Text(model.status)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
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
                    Text(model.activeShow?.title ?? "ShowCue")
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
                        Text("PROCHAIN TOP")
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

                        Text("Top à \(cue.timeText)")
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

                    Text(model.activeShow == nil ? "En attente d’un numéro ShowCue" : "Fin de conduite")
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

        WindowGroup("Visualiseur ShowCue", id: "visual-monitor") {
            VisualMonitorView(model: model)
        }
        .defaultSize(width: 565, height: 330)
    }
}
