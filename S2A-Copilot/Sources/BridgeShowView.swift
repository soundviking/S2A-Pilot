import SwiftUI
import AppKit
import WebKit
import ImageIO

struct VisualMonitorView: View {
    @ObservedObject var model: AppModel
    @AppStorage("s2a-language") private var language = defaultInterfaceLanguage
    @StateObject private var chrome = BridgeWindowChrome()
    @State private var window: NSWindow?

    var body: some View {
        BridgeShowWebView(model:model,language:language)
            .frame(minWidth:820,minHeight:540)
            .preferredColorScheme(.dark)
            .background(WindowAccessor { window in
                self.window = window
                chrome.configure(window:window,model:model)
            })
            .onAppear { model.startVisualMonitor(); chrome.configure(window:window,model:model) }
            .onChange(of:model.visualAlwaysOnTop) { _ in chrome.configure(window:window,model:model) }
    }
}

final class BridgeZoomPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override func keyDown(with event:NSEvent) {
        if event.keyCode == 53 { close() } else { super.keyDown(with:event) }
    }
}
final class BridgeZoomImageView: NSImageView {
    override func mouseDown(with event:NSEvent) { window?.close() }
}

final class BridgeImageHandler: NSObject, WKURLSchemeHandler {
    var urls: [String:URL] = [:]
    private let cache = NSCache<NSString,NSData>()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requested = urlSchemeTask.request.url, let url = urls[requested.absoluteString] else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        do {
            let data:Data
            if let cached = cache.object(forKey:url.path as NSString) { data = cached as Data }
            else { data = try Data(contentsOf:url); cache.setObject(data as NSData,forKey:url.path as NSString) }
            let mime = ["png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg","gif":"image/gif","webp":"image/webp"][url.pathExtension.lowercased()] ?? "image/png"
            urlSchemeTask.didReceive(URLResponse(url:requested,mimeType:mime,expectedContentLength:data.count,textEncodingName:nil))
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch { urlSchemeTask.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

struct BridgeShowWebView: NSViewRepresentable {
    @ObservedObject var model: AppModel
    let language: String

    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.setURLSchemeHandler(context.coordinator.images,forURLScheme:"bridge-image")
        configuration.userContentController.add(context.coordinator,name:"bridgeShow")
        let view = WKWebView(frame:.zero,configuration:configuration)
        view.navigationDelegate = context.coordinator
        view.setValue(false,forKey:"drawsBackground")
        context.coordinator.webView = view
        if let root = Bundle.main.resourceURL?.appendingPathComponent("Show") {
            context.coordinator.root = root
            view.loadFileURL(root.appendingPathComponent("index.html"),allowingReadAccessTo:root)
        }
        return view
    }
    func updateNSView(_ view:WKWebView,context:Context) { context.coordinator.update(model:model,language:language) }
    static func dismantleNSView(_ view:WKWebView,coordinator:Coordinator) {
        view.configuration.userContentController.removeScriptMessageHandler(forName:"bridgeShow")
        coordinator.closeZoom()
        coordinator.endShare()
    }

    final class Coordinator:NSObject,WKNavigationDelegate,WKScriptMessageHandler,NSWindowDelegate {
        weak var webView:WKWebView?
        var root:URL?
        let images = BridgeImageHandler()
        private var pending:(String,String,String)?
        private var busy = false
        private var contentKey = ""
        private var zoomPanel:BridgeZoomPanel?
        private weak var model: AppModel?

        private struct Share: Decodable {
            let id: String
            let host: String
            let invite: String
            let backstage: Bool?
        }
        private static let relay = URL(string:"https://pilot.s2a-production.com/copilot/")!
        private var share: Share?
        private var shareTask: Task<Void,Never>?
        private var openingShare = false
        private var stoppingShare = false
        private var closed = false
        private var sharedWorkspace = ""
        private var lastTopSync = Date.distantPast
        private var shareLocked = false
        private var managingShare = false
        private var lastRelayMessage = ""
        private var topsFile: URL?
        private var remoteState: [String:Any]?
        private var remoteSample = ProcessInfo.processInfo.systemUptime
        private let thumbnails = NSCache<NSURL,NSString>()

        private static func relayRequest(_ action:String, token:String? = nil, body:[String:Any]) async throws -> Data {
            var request = URLRequest(url:relay.appendingPathComponent("api.php").appending(queryItems:[URLQueryItem(name:"action",value:action)]))
            request.httpMethod = "POST"
            request.timeoutInterval = 10
            request.setValue("application/json",forHTTPHeaderField:"Content-Type")
            if let token { request.setValue("Bearer "+token,forHTTPHeaderField:"Authorization") }
            request.httpBody = try JSONSerialization.data(withJSONObject:body)
            let (data,response) = try await URLSession.shared.data(for:request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let reply = (try? JSONSerialization.jsonObject(with:data)) as? [String:Any]
                throw NSError(domain:"Copilot",code:(response as? HTTPURLResponse)?.statusCode ?? 0,
                              userInfo:[NSLocalizedDescriptionKey:reply?["error"] as? String ?? "Relais Copilot indisponible."])
            }
            return data
        }
        private func shareUI(_ message:String, link:String = "") {
            lastRelayMessage = message
            webView?.evaluateJavaScript("window.S2ABridge.shareStatus(\(json(["message":message,"link":link,"active":share != nil])))")
        }
        private func shareLink(_ share:Share) -> String {
            Self.relay.appendingPathComponent("index.php").absoluteString+"#s="+share.id+"&i="+share.invite+"&bridge=1"
        }
        private func startShare() {
            if let share { shareUI(stoppingShare ? "Arrêt du partage…" : "Partage actif · Régie et Backstage",link:shareLink(share)); return }
            guard !openingShare,!closed,let workspace = model?.workspace,let folder = workspace.projectFolder,remoteState != nil else {
                if !openingShare { shareUI("Connectez Bridge à un workspace QLab.") }
                return
            }
            openingShare = true
            shareUI("Création du partage…")
            Task { @MainActor [self] in
                defer { openingShare = false }
                do {
                    let key = Data(workspace.id.utf8).base64EncodedString().replacingOccurrences(of:"/",with:"_")
                    let file = folder.appendingPathComponent("S2A Pilot",isDirectory:true).appendingPathComponent("backstage-"+key+".json")
                    let tops: [[String:Any]]
                    if FileManager.default.fileExists(atPath:file.path) {
                        guard let saved = try JSONSerialization.jsonObject(with:Data(contentsOf:file)) as? [[String:Any]] else {
                            shareUI("Le fichier des Tops Backstage est illisible.")
                            return
                        }
                        tops = saved
                    } else { tops = [] }
                    let data = try await Self.relayRequest("create",body:["bridge":true,"backstage":true,"tops":tops])
                    let created = try JSONDecoder().decode(Share.self,from:data)
                    guard !closed,model?.workspace?.id == workspace.id,created.backstage == true else {
                        _ = try? await Self.relayRequest("stop",token:created.host,body:["id":created.id])
                        if !closed { shareUI(created.backstage == true ? "Le workspace QLab a changé." : "Mettez le relais Copilot à jour pour activer Backstage.") }
                        return
                    }
                    share = created
                    sharedWorkspace = workspace.id
                    topsFile = file
                    lastTopSync = .distantPast
                    shareLocked = false
                    webView?.evaluateJavaScript("window.S2ABridge.shareMembers({viewers:[],locked:false,now:0})",completionHandler:nil)
                    shareUI("Partage actif · Régie et Backstage",link:shareLink(created))
                    shareTask = Task { @MainActor [weak self] in
                        while !Task.isCancelled {
                            await self?.publishShare()
                            try? await Task.sleep(nanoseconds:450_000_000)
                        }
                    }
                } catch { shareUI(error.localizedDescription) }
            }
        }
        private func publishShare() async {
            guard !stoppingShare,let share,var state = remoteState else { return }
            state["sampleAge"] = ProcessInfo.processInfo.systemUptime - remoteSample
            do {
                _ = try await Self.relayRequest("publish",token:share.host,body:["id":share.id,"state":state])
                guard self.share?.id == share.id else { return }
                if Date().timeIntervalSince(lastTopSync) >= 3 {
                    let members = try await Self.relayRequest("members",token:share.host,body:["id":share.id])
                    guard self.share?.id == share.id,!stoppingShare else { return }
                    try saveTops(members,to:topsFile)
                    showMembers(members)
                    lastTopSync = Date()
                }
                shareUI("Partage actif · Régie et Backstage",link:shareLink(share))
            } catch {
                guard !Task.isCancelled,self.share?.id == share.id else { return }
                if (error as NSError).domain == "Copilot", (error as NSError).code == 410 {
                    stopShare()
                } else {
                    shareUI("Reconnexion · "+error.localizedDescription,link:shareLink(share))
                }
            }
        }
        private func stopShare() {
            shareTask?.cancel()
            shareTask = nil
            guard !stoppingShare,let share else { return }
            stoppingShare = true
            shareUI("Arrêt du partage…",link:shareLink(share))
            let file = topsFile
            Task { @MainActor [self] in
                defer { stoppingShare = false }
                do {
                    let response = try await Self.relayRequest("stop",token:share.host,body:["id":share.id])
                    self.share = nil
                    do {
                        try saveTops(response,to:file)
                        shareUI("Partage arrêté")
                    } catch {
                        shareUI("Partage arrêté · Tops non sauvegardés : "+error.localizedDescription)
                    }
                } catch {
                    let failure = error as NSError
                    if failure.domain == "Copilot",failure.code == 410 {
                        self.share = nil
                        shareUI("Partage terminé")
                    } else {
                        shareUI("Arrêt non confirmé · "+error.localizedDescription,link:shareLink(share))
                    }
                }
            }
        }
        func endShare() { closed = true; stopShare() }

        private func showMembers(_ data:Data) {
            guard let members = (try? JSONSerialization.jsonObject(with:data)) as? [String:Any] else { return }
            shareLocked = members["locked"] as? Bool ?? false
            webView?.evaluateJavaScript("window.S2ABridge.shareMembers(\(json(members)))")
        }

        private func manageShare(_ action:String, viewerID:String? = nil) {
            guard let share,!managingShare,!stoppingShare else { return }
            managingShare = true
            var payload:[String:Any] = ["id":share.id]
            if let viewerID { payload["viewer"] = viewerID }
            else { payload["locked"] = !shareLocked }
            Task { @MainActor [self] in
                defer { managingShare = false }
                do {
                    _ = try await Self.relayRequest(action,token:share.host,body:payload)
                    let members = try await Self.relayRequest("members",token:share.host,body:["id":share.id])
                    guard self.share?.id == share.id,!stoppingShare else { return }
                    showMembers(members)
                } catch {
                    if self.share?.id == share.id { shareUI(error.localizedDescription,link:shareLink(share)) }
                }
            }
        }

        private func saveTops(_ response:Data,to file:URL?) throws {
            guard let file,let result = try JSONSerialization.jsonObject(with:response) as? [String:Any],
                  let tops = result["tops"] as? [[String:Any]] else { return }
            let data = try JSONSerialization.data(withJSONObject:tops,options:[.sortedKeys])
            if (try? Data(contentsOf:file)) == data { return }
            try FileManager.default.createDirectory(at:file.deletingLastPathComponent(),withIntermediateDirectories:true)
            try data.write(to:file,options:.atomic)
        }

        private func thumbnail(_ url:URL) -> String {
            if let cached = thumbnails.object(forKey:url as NSURL) { return cached as String }
            guard let source = CGImageSourceCreateWithURL(url as CFURL,nil),
                  let image = CGImageSourceCreateThumbnailAtIndex(source,0,[
                    kCGImageSourceCreateThumbnailFromImageAlways:true,
                    kCGImageSourceCreateThumbnailWithTransform:true,
                    kCGImageSourceThumbnailMaxPixelSize:280
                  ] as CFDictionary),
                  let data = NSBitmapImageRep(cgImage:image).representation(using:.jpeg,properties:[.compressionFactor:0.55]) else { return "" }
            let result = "data:image/jpeg;base64,"+data.base64EncodedString()
            guard result.utf8.count <= 45000 else { return "" }
            thumbnails.setObject(result as NSString,forKey:url as NSURL)
            return result
        }

        private func updateRemoteState(state:[String:Any],content:[String:Any],cues:[[String:Any]],mapped:[String:URL],hasImport:Bool,title:String) {
            let workspace = state["workspaceID"] as? String ?? ""
            if share != nil && workspace != sharedWorkspace { stopShare() }
            let roots = state["roots"] as? [[String:Any]] ?? []
            let current = state["currentID"] as? String ?? ""
            let elapsed = state["elapsed"] as? Double ?? 0
            let selected = state["selectedID"] as? String ?? ""
            let running = state["running"] as? Bool == true && state["lost"] as? Bool != true
            var display:[[String:Any]] = []
            var active = "", next = "", imageBytes = 0
            var images:[String:String] = [:]
            for root in roots.prefix(300) {
                guard let id = root["id"] as? String else { continue }
                display.append(["id":id,"name":root["name"] ?? "","number":root["number"] ?? "",
                                "description":root["notes"] ?? "","duration":root["duration"] ?? 0,"running":root["running"] as? Bool == true && root["paused"] as? Bool != true && state["lost"] as? Bool != true])
                guard hasImport,id == current else { continue }
                for cue in cues.prefix(max(0,300-roots.count)) {
                    guard let cueID = cue["id"] as? String,let time = cue["time"] as? Double else { continue }
                    let childID = id+":"+cueID
                    if time <= elapsed+0.0001 { active = childID }
                    else if next.isEmpty && running { next = childID }
                    var child = cue
                    child["id"] = childID
                    child["child"] = true
                    child["image"] = ""
                    if share != nil, let key = cue["image"] as? String, let url = mapped[key] {
                        let image = thumbnail(url)
                        if !image.isEmpty,imageBytes+image.utf8.count <= 280000 {
                            let imageKey = "img"+String(images.count)
                            imageBytes += image.utf8.count
                            images[imageKey] = image
                            child["imageKey"] = imageKey
                        }
                    }
                    display.append(child)
                }
            }
            remoteSample = ProcessInfo.processInfo.systemUptime
            remoteState = ["schema":1,"show":!workspace.isEmpty,"playing":running,"title":title,
                           "selected":selected,"current":current,"sourceLost":state["lost"] ?? false,"time":elapsed,"duration":content["duration"] ?? 0,
                           "active":active,"next":next,"cues":display,"images":images]
        }

        private func json(_ value:Any) -> String {
            guard let bytes = try? JSONSerialization.data(withJSONObject:value,options:[.sortedKeys]),let string = String(data:bytes,encoding:.utf8) else { return "{}" }
            return string
        }
        func update(model:AppModel,language:String) {
            self.model = model
            let snapshot = model.runtimeSnapshot
            let current = snapshot?.roots.first(where:{$0.id == model.currentRuntimeID})
            let imported = model.activeShow
            var mapped:[String:URL] = [:]
            var cues:[[String:Any]] = imported?.cues.sorted(by:{$0.time<$1.time}).map { cue in
                let imageKey = "bridge-image://asset/\(imported?.groupID ?? "pending")/\(cue.index)"
                if let path = imported?.imagePaths[String(cue.index)],let folder = model.workspace?.projectFolder {
                    mapped[imageKey] = path.hasPrefix("/") ? URL(fileURLWithPath:path) : folder.appendingPathComponent(path)
                }
                return ["id":String(cue.index),"number":String(cue.index),"time":cue.time,"name":cue.name,"description":cue.monitorDescription ?? "","editName":cue.name,"editDescription":cue.description ?? "","image":mapped[imageKey] == nil ? "" : imageKey]
            } ?? current.map { [["id":$0.id,"number":$0.number,"time":0,"name":$0.name,"description":$0.notes,"editName":$0.qName,"editDescription":$0.notes,"image":""]] } ?? []
            if imported == nil, current != nil, let standby = snapshot?.roots.first(where:{$0.id == snapshot?.standbyID}), standby.id != current?.id {
                cues.append(["id":standby.id,"number":standby.number,"time":NSNull(),"name":standby.name,"description":standby.notes,"editName":standby.qName,"editDescription":standby.notes,"image":""])
            }
            if !model.synchronizationLost { images.urls = mapped }
            let content:[String:Any] = ["id":imported?.groupID ?? current?.id ?? "", "title":imported.flatMap { show in snapshot?.roots.first(where: { $0.id == show.groupID })?.name } ?? imported?.title ?? current?.name ?? model.workspace?.name ?? "S2A Pilot Bridge", "duration":imported?.showDuration ?? current?.duration ?? 0,"generic":imported == nil,"manual":imported?.conductType == "manual","showLayout":imported?.showLayout ?? "maverick","cues":cues]
            let labels:[String:String] = ["flow":L("Déroulé du spectacle"),"filter":L("Type de Cue"),"allTypes":L("Tous les types"),"noTypes":L("Aucun type sélectionné"),"audio":L("Audio"),"video":L("Vidéo"),"pilot":"S2A Pilot","network":"Network","other":L("Autres"),"noMatch":L("Aucune Cue pour ce filtre."),"selectionHidden":L("La Cue sélectionnée est masquée par le filtre."),"showAll":L("Tout afficher"),"wait":L("En attente d’un numéro S2A Pilot"),"close":L("Fermer"),"zoomBack":L("Cliquer / toucher pour revenir"),"zoom":L("Agrandir le visuel"),"noVisual":L("Aucun visuel"),"countdown":L("Décompte"),"native":L("Cue QLab — déclenchement suivant au GO"),"edit":L("Modifier"),"editTitle":L("Modifier la Cue"),"name":L("Nom"),"description":L("Description / indication de conduite"),"save":L("Enregistrer"),"cancel":L("Annuler"),"saving":L("Enregistrement…"),"pilotEdit":L("Repère Pilot : titre et description sauvegardés dans Bridge."),"qlabEdit":L("Nom et notes synchronisés avec QLab."),"workspaceChanged":L("Le workspace a changé. Rouvre l’édition de la Cue."),"changed":L("La Cue a été modifiée ailleurs. Rouvre l’édition avant de réessayer.")]
            let state:[String:Any] = ["language":language,"workspaceID":model.workspace?.id ?? "","filters":model.visualCueFilters.map(\.rawValue).sorted(),"editBusy":model.bridgeEditInFlight,"editReply":model.bridgeEditReply?.json ?? [:],"status":model.visualStatus.localized,"lost":model.synchronizationLost,"elapsed":model.visualElapsed,"running":model.visualRunning,"currentID":model.currentRuntimeID ?? "","standbyID":snapshot?.standbyID ?? "","selectedID":model.selectedBridgeID ?? "","labels":labels,"roots":snapshot?.roots.map { cue in ["id":cue.id,"name":cue.name,"qName":cue.qName,"notes":cue.notes,"kind":cue.kind,"duration":model.savedShows.first(where:{$0.groupID == cue.id})?.showDuration ?? cue.duration,"number":cue.number,"category":BridgeFlowFilter.category(kind:cue.kind,pilot:model.savedShows.contains(where:{$0.groupID == cue.id})).rawValue,"running":cue.running,"paused":cue.paused,"pilot":model.savedShows.contains(where:{$0.groupID == cue.id})] } ?? []]
            updateRemoteState(state:state,content:content,cues:cues,mapped:mapped,hasImport:imported != nil,title:model.workspace?.name ?? "S2A Pilot Bridge")
            let serialized = model.synchronizationLost && !contentKey.isEmpty ? contentKey : json(content)
            pending = (json(state),serialized,serialized)
            flush()
        }
        private func flush() {
            guard !busy,let payload = pending,let webView else { return }
            pending = nil; busy = true
            let content = payload.2 == contentKey ? "null" : payload.1
            webView.evaluateJavaScript("(()=>{if(!window.S2ABridge)return false;window.S2ABridge.render(\(payload.0),\(content));return true})()") { [weak self] result,error in
                guard let self else { return }
                self.busy = false
                if error == nil && (result as? Bool) == true { self.contentKey = payload.2 }
                else if self.pending == nil { self.pending = payload }
                if result as? Bool == true { self.flush() }
            }
        }
        func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!) { flush() }
        func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            let allowed = url.isFileURL && root.map { url.standardizedFileURL.path.hasPrefix($0.standardizedFileURL.path+"/") } == true
            decisionHandler(allowed ? .allow : .cancel)
        }
        func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage) {
            guard message.frameInfo.isMainFrame, let body = message.body as? [String:Any] else { return }
            if body["type"] as? String == "share" { startShare(); return }
            if body["type"] as? String == "lockShare" { manageShare("lock"); return }
            if body["type"] as? String == "revokeShare",let id = body["id"] as? String { manageShare("revoke",viewerID:id); return }
            if body["type"] as? String == "healthShare" {
                Task { @MainActor in
                    do {
                        _ = try await Self.relayRequest("health",body:[:])
                        shareUI("Relais prêt, stockage privé vérifié.")
                    } catch { shareUI(error.localizedDescription) }
                }
                return
            }
            if body["type"] as? String == "hostingHelp",let url = URL(string:"https://s2a-production.com/S2A-Pilot-Beta/copilot-test/index.php") {
                NSWorkspace.shared.open(url)
                return
            }
            if body["type"] as? String == "diagnoseShare" {
                let report = json(["source":"Bridge","partageActif":share != nil,"connexionsFermées":shareLocked,"état":lastRelayMessage])
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(report,forType:.string)
                shareUI("Diagnostic de connexion copié.",link:share.map(shareLink) ?? "")
                return
            }
            if body["type"] as? String == "stopShare" { stopShare(); return }
            if body["type"] as? String == "copyShare", let share {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(shareLink(share),forType:.string)
                return
            }
            if body["type"] as? String == "filters", let values = body["values"] as? [String] {
                let filters = values.compactMap(BridgeFlowFilter.init(rawValue:))
                guard filters.count == values.count else { return }
                model?.setVisualCueFilters(Set(filters))
                return
            }
            if body["type"] as? String == "select", let id = body["id"] as? String {
                model?.selectBridgeCue(id)
                return
            }
            if body["type"] as? String == "edit", let data = try? JSONSerialization.data(withJSONObject: body),
               let edit = try? JSONDecoder().decode(BridgeEditRequest.self, from: data) {
                model?.editBridgeCue(edit)
                return
            }
            guard body["type"] as? String == "zoom" else { return }
            if body["open"] as? Bool == true {
                guard let src = body["src"] as? String, let url = images.urls[src], let image = NSImage(contentsOf:url),
                      let screen = webView?.window?.screen ?? NSScreen.main else { return }
                zoomPanel?.close()
                let panel = BridgeZoomPanel(contentRect:screen.frame,styleMask:[.borderless],backing:.buffered,defer:false)
                panel.delegate = self
                panel.level = .screenSaver
                panel.collectionBehavior = [.canJoinAllSpaces,.fullScreenAuxiliary]
                panel.backgroundColor = .black
                panel.isReleasedWhenClosed = false
                let imageView = BridgeZoomImageView(frame:NSRect(origin:.zero,size:screen.frame.size))
                imageView.image = image
                imageView.imageScaling = .scaleProportionallyUpOrDown
                imageView.setAccessibilityLabel(body["title"] as? String ?? L("Agrandir le visuel"))
                imageView.setAccessibilityHelp(L("Cliquer / toucher pour revenir"))
                let close = NSButton(title:L("Fermer"),target:panel,action:#selector(NSWindow.close))
                close.frame = NSRect(x:screen.frame.width-115,y:screen.frame.height-54,width:95,height:34)
                close.autoresizingMask = [.minXMargin,.minYMargin]
                imageView.addSubview(close)
                panel.contentView = imageView
                zoomPanel = panel
                panel.makeKeyAndOrderFront(nil)
            } else { closeZoom() }
        }
        func closeZoom() { zoomPanel?.close() }
        func windowWillClose(_ notification:Notification) {
            guard notification.object as? NSWindow === zoomPanel else { return }
            zoomPanel = nil
            webView?.evaluateJavaScript("window.S2ABridge.closeZoom(false)")
        }
    }
}
