import Foundation

// Filtering affects only the visible running order, never QLab or the show clock.
enum BridgeFlowFilter: String, CaseIterable {
    case all, audio, video, pilot, network, other

    static var types: Set<Self> { Set(allCases.filter { $0 != .all }) }

    static func restored(from preferences: UserDefaults) -> Set<Self> {
        if let values = preferences.stringArray(forKey:"s2a-bridge-flow-filters") {
            if values.contains("all") { return types }
            let valid = Set(values.compactMap(Self.init(rawValue:))).intersection(types)
            return !values.isEmpty && valid.isEmpty ? types : valid
        }
        if let old = preferences.string(forKey:"s2a-bridge-flow-filter"), let filter = Self(rawValue:old), filter != .all {
            return [filter]
        }
        return types
    }

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
