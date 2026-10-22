import Foundation

// Filtering affects only the visible running order, never QLab or the show clock.
enum BridgeFlowFilter: String, CaseIterable {
    case all, audio, video, pilot, network, other

    static func category(kind: String, pilot: Bool) -> Self {
        if pilot { return .pilot }
        switch kind.lowercased() {
        case "audio", "mic": return .audio
        case "video", "camera", "text": return .video
        case "network": return .network
        default: return .other
        }
    }
}
