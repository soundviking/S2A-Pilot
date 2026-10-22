import AppKit
import SwiftUI

private struct BridgeWindowIdentity: View {
    @ObservedObject var model: AppModel
    @AppStorage("s2a-language") private var language = defaultInterfaceLanguage

    var body: some View {
        HStack(spacing: 8) {
            Image(nsImage: NSImage(named: NSImage.Name("S2APilotBridgeIcon")) ?? NSImage())
                .resizable().scaledToFit().frame(width: 23, height: 23)
            VStack(alignment: .leading, spacing: 0) {
                Text("S2A Pilot Bridge · Show").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                Text(model.visualStatus.localized).font(.system(size: 11))
                    .foregroundStyle(model.synchronizationLost ? Color.red : Color.white.opacity(0.7))
            }.lineLimit(1)
            Spacer(minLength: 0)
        }.frame(width: 310, height: 28)
    }
}

private struct BridgeWindowPin: View {
    @ObservedObject var model: AppModel
    @AppStorage("s2a-language") private var language = defaultInterfaceLanguage

    var body: some View {
        HStack(spacing: 8) {
            Text(L("Toujours au premier plan")).font(.system(size: 11)).foregroundStyle(.white).lineLimit(1)
            Toggle("", isOn: $model.visualAlwaysOnTop)
                .labelsHidden().toggleStyle(.switch).controlSize(.small)
                .accessibilityLabel(L("Toujours au premier plan"))
        }.frame(width: 230, height: 28, alignment: .trailing)
    }
}

final class BridgeWindowChrome: NSObject, ObservableObject, NSToolbarDelegate {
    private weak var window: NSWindow?
    private weak var model: AppModel?
    private let identityID = NSToolbarItem.Identifier("s2a.bridge.identity")
    private let pinID = NSToolbarItem.Identifier("s2a.bridge.pin")

    func configure(window: NSWindow?, model: AppModel) {
        guard let window else { return }
        self.model = model
        window.title = "S2A Pilot Bridge — Show"
        window.level = model.visualAlwaysOnTop ? .floating : .normal
        window.collectionBehavior = [.fullScreenAuxiliary]
        guard self.window !== window else { return }
        self.window = window
        window.appearance = NSAppearance(named: .darkAqua)
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = false
        window.toolbarStyle = .unifiedCompact
        let toolbar = NSToolbar(identifier: "s2a.bridge.show.compact")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        toolbar.showsBaselineSeparator = false
        window.toolbar = toolbar
        // Keep the standard close/minimize/full-screen controls owned by macOS.
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [identityID, .flexibleSpace, pinID]
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        toolbarDefaultItemIdentifiers(toolbar)
    }

    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier identifier: NSToolbarItem.Identifier,
                 willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        guard let model else { return nil }
        let item = NSToolbarItem(itemIdentifier: identifier)
        if identifier == identityID {
            item.label = "S2A Pilot Bridge · Show"
            item.view = NSHostingView(rootView: BridgeWindowIdentity(model: model).environment(\.colorScheme,.dark))
        } else if identifier == pinID {
            item.label = L("Toujours au premier plan")
            item.view = NSHostingView(rootView: BridgeWindowPin(model: model).environment(\.colorScheme,.dark))
        } else { return nil }
        item.isBordered = false
        item.view?.appearance = NSAppearance(named: .darkAqua)
        return item
    }
}
