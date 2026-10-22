import SwiftUI
import AppKit
import WebKit

struct VisualMonitorView: View {
    @ObservedObject var model: AppModel
    @AppStorage("s2a-language") private var language = defaultInterfaceLanguage
    @State private var window: NSWindow?

    private func updateWindow() {
        window?.title = "S2A Pilot Bridge — Show"
        window?.level = model.visualAlwaysOnTop ? .floating : .normal
        window?.collectionBehavior = [.fullScreenAuxiliary]
    }

    var body: some View {
        BridgeShowWebView(model:model,language:language)
            .frame(minWidth:820,minHeight:540)
            .background(WindowAccessor { window = $0; updateWindow() })
            .toolbar {
                Toggle(L("Toujours au premier plan"),isOn:$model.visualAlwaysOnTop)
                    .toggleStyle(.switch).controlSize(.small)
            }
            .onAppear { model.startVisualMonitor(); updateWindow() }
            .onChange(of:model.visualAlwaysOnTop) { _ in updateWindow() }
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
                return ["id":String(cue.index),"time":cue.time,"name":cue.name,"description":cue.monitorDescription ?? "","image":mapped[imageKey] == nil ? "" : imageKey]
            } ?? current.map { [["id":$0.id,"time":0,"name":$0.name,"description":$0.notes,"image":""]] } ?? []
            if imported == nil, current != nil, let standby = snapshot?.roots.first(where:{$0.id == snapshot?.standbyID}), standby.id != current?.id {
                cues.append(["id":standby.id,"time":NSNull(),"name":standby.name,"description":standby.notes,"image":""])
            }
            if !model.synchronizationLost { images.urls = mapped }
            let content:[String:Any] = ["id":imported?.groupID ?? current?.id ?? "", "title":imported?.title ?? current?.name ?? model.workspace?.name ?? "S2A Pilot Bridge", "duration":imported?.showDuration ?? current?.duration ?? 0,"generic":imported == nil,"cues":cues]
            let labels:[String:String] = ["flow":L("Déroulé du spectacle"),"wait":L("En attente d’un numéro S2A Pilot"),"close":L("Fermer"),"zoomBack":L("Cliquer / toucher pour revenir"),"zoom":L("Agrandir le visuel"),"noVisual":L("Aucun visuel"),"countdown":L("Décompte"),"native":L("Cue QLab — déclenchement suivant au GO")]
            let state:[String:Any] = ["language":language,"status":model.visualStatus.localized,"lost":model.synchronizationLost,"elapsed":model.visualElapsed,"running":model.visualRunning,"currentID":model.currentRuntimeID ?? "","standbyID":snapshot?.standbyID ?? "","selectedID":model.selectedBridgeID ?? "","labels":labels,"roots":snapshot?.roots.map { cue in ["id":cue.id,"name":cue.name,"kind":cue.kind,"number":cue.number,"running":cue.running,"paused":cue.paused,"pilot":model.savedShows.contains(where:{$0.groupID == cue.id})] } ?? []]
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
            if body["type"] as? String == "select", let id = body["id"] as? String {
                model?.selectBridgeCue(id)
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
