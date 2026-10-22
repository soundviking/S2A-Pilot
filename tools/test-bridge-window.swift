import AppKit
import SwiftUI
import WebKit

final class WindowTest: NSObject {
    let window = NSWindow(contentRect:NSRect(x:80,y:80,width:1360,height:850),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
    var model: AppModel!
    var originalButtons: [NSButton] = []

    func start() throws {
        let fixture = "S2A_RUNTIME_V3\u{1e}p\u{1e}p\u{1e}" + [
            ["R","a","Accueil du public","Audio","false","false","0","60","Notes","","1.20","Accueil du public"],
            ["R","p","Démonstration Pilot","Group","true","false","20","200","Notes","","2","Démonstration Pilot"],
            ["R","v","Projection","Video","false","false","0","60","Notes","","3","Projection"],
            ["R","n","Message réseau","Network","false","false","0","0","Notes","","4","Message réseau"]
        ].map{$0.joined(separator:"\u{1f}")+"\u{1e}"}.joined()
        let suite = "s2a-window-test-"+UUID().uuidString
        let preferences = UserDefaults(suiteName:suite)!
        model = AppModel(preferences:preferences,commandExecutor:{ _,arguments,_,_ in
            precondition(arguments.contains(where:{$0.contains("S2A_RUNTIME_V3")}))
            return fixture
        })
        model.workspace = WorkspaceInfo(id:"fixture",name:"Test",workspacePath:"/tmp/fixture.qlab5")
        let cues = [0.0,25,55,80,120].enumerated().map { index,time in
            ShowCueProject.Cue(index:index,time:time,type:nil,name:["Ouverture","Entrée des artistes","Lumière ambre","Solo","Salut"][index],description:"Consigne de scène",isBase:nil,imagePath:nil,mediaActions:nil)
        }
        let icon = Bundle.main.resourceURL!.appendingPathComponent("Show/bridge.png").path
        model.savedShows = [SavedShowCue(groupID:"p",mediaID:nil,audioID:nil,title:"Démonstration Pilot",cues:cues,imagePaths:Dictionary(uniqueKeysWithValues:cues.map{(String($0.index),icon)}),importedAt:Date(),showDuration:200)]
        model.runtimeSnapshot = try BridgeRuntimeSnapshot.parse(fixture)
        model.currentRuntimeID = "p"
        originalButtons = [.closeButton,.miniaturizeButton,.zoomButton].compactMap{window.standardWindowButton($0)}
        precondition(originalButtons.count == 3)
        window.contentView = NSHostingView(rootView:VisualMonitorView(model:model))
        window.orderFront(nil)
        DispatchQueue.main.asyncAfter(deadline:.now()+2) { self.check(width:1360) }
        DispatchQueue.main.asyncAfter(deadline:.now()+15) { fputs("Window test timed out\n",stderr); exit(1) }
    }

    func findWebView(_ view: NSView) -> WKWebView? {
        if let web = view as? WKWebView { return web }
        return view.subviews.compactMap(findWebView).first
    }

    func check(width: CGFloat) {
        precondition(window.toolbarStyle == .unifiedCompact)
        precondition(window.appearance?.name == .darkAqua)
        precondition(window.toolbar?.visibleItems?.contains(where:{$0.itemIdentifier.rawValue == "s2a.bridge.pin"}) == true)
        precondition(window.toolbar?.visibleItems?.contains(where:{$0.itemIdentifier.rawValue == "s2a.bridge.identity"}) == true)
        for (i,type) in [NSWindow.ButtonType.closeButton,.miniaturizeButton,.zoomButton].enumerated() {
            let button = window.standardWindowButton(type)!
            precondition(button === originalButtons[i] && !button.isHidden && button.isEnabled)
        }
        let height = window.frame.height - window.contentLayoutRect.height
        precondition(height <= 60, "The compact title bar should occupy one row")
        guard let web = findWebView(window.contentView!) else { fatalError("Show WebKit view missing") }
        web.evaluateJavaScript("(()=>{const w=document.querySelector('.workspace').getBoundingClientRect();return w.y===0&&Math.abs(w.height-innerHeight)<1&&document.querySelector('header')===null})()") { result,error in
            precondition(error == nil && result as? Bool == true, "Web content must use the full height below the native bar")
            web.takeSnapshot(with:nil) { image,error in
                precondition(image != nil && error == nil)
                let png = NSBitmapImageRep(data:image!.tiffRepresentation!)!.representation(using:.png,properties:[:])!
                try! png.write(to:URL(fileURLWithPath:"/tmp/s2a-bridge-window-\(Int(width)).png"))
                if let full = self.window.contentView?.superview,
                   let bitmap = full.bitmapImageRepForCachingDisplay(in:full.bounds) {
                    full.cacheDisplay(in:full.bounds,to:bitmap)
                    if let data=bitmap.representation(using:.png,properties:[:]) {
                        try! data.write(to:URL(fileURLWithPath:"/tmp/s2a-bridge-frame-\(Int(width)).png"))
                    }
                }
                print("PASS native window \(Int(width))px: original traffic lights, dark unified compact bar \(Int(height))px, visible pin switch and full-height Show")
                if width > 820 {
                    self.window.setContentSize(NSSize(width:820,height:650))
                    DispatchQueue.main.asyncAfter(deadline:.now()+0.4) { self.check(width:820) }
                } else {
                    self.model.visualAlwaysOnTop = false
                    DispatchQueue.main.asyncAfter(deadline:.now()+0.2) {
                        precondition(self.window.level == .normal)
                        self.model.visualAlwaysOnTop = true
                        DispatchQueue.main.asyncAfter(deadline:.now()+0.2) {
                            precondition(self.window.level == .floating)
                            self.model.stopVisualMonitor()
                            self.window.orderOut(nil)
                            print("PASS actual Show view: topmost binding updates the native window level in both directions; no QLab connection used")
                            exit(0)
                        }
                    }
                }
            }
        }
    }
}

@main struct NativeWindowTests {
    static func main() throws {
        let app=NSApplication.shared
        app.setActivationPolicy(.accessory)
        let test=WindowTest()
        try test.start()
        withExtendedLifetime(test) { app.run() }
    }
}
