import Foundation

let bridgeSupportedLanguages = ["fr", "en", "es", "de"]
func normalizedBridgeLanguage(_ value: String) -> String {
    value.lowercased().components(separatedBy: CharacterSet(charactersIn: "-_"))[0]
}
let defaultInterfaceLanguage = Locale.preferredLanguages.map(normalizedBridgeLanguage).first(where: bridgeSupportedLanguages.contains) ?? "en"
func bridgeLanguage() -> String {
    let saved = normalizedBridgeLanguage(UserDefaults.standard.string(forKey: "s2a-language") ?? defaultInterfaceLanguage)
    return bridgeSupportedLanguages.contains(saved) ? saved : defaultInterfaceLanguage
}

enum BridgeStrings {
    static let catalog: [String: [String: String]] = {
        guard let url = Bundle.main.url(forResource: "interface", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let catalog = try? JSONDecoder().decode([String: [String: String]].self, from: data) else { return [:] }
        return catalog
    }()
    static func text(_ key: String, values: [String: String] = [:], language: String = bridgeLanguage(), catalog: [String: [String: String]] = catalog) -> String {
        let template = catalog[key]?[language] ?? (language == "fr" ? key : catalog[key]?["en"] ?? key)
        // Substitute only template tokens, never re-translate user-provided values.
        let expression = try! NSRegularExpression(pattern: "\\{(\\w+)\\}")
        let source = template as NSString
        var result = template
        for match in expression.matches(in: template, range: NSRange(location: 0, length: source.length)).reversed() {
            let name = source.substring(with: match.range(at: 1))
            if let value = values[name], let range = Range(match.range, in: result) { result.replaceSubrange(range, with: value) }
        }
        return result
    }
}
func L(_ key: String, _ values: [String: String] = [:]) -> String { BridgeStrings.text(key, values: values) }

// Model messages keep their key and values so a language change also updates old statuses.
protocol BridgeLocalizedError: Error { var bridgeText: BridgeText { get } }
struct BridgeText: Equatable {
    let key: String
    let values: [String: String]
    let raw: Bool
    let parts: [BridgeText]?
    let separator: String
    init(_ key: String, _ values: [String: String] = [:]) { self.key=key; self.values=values; raw=false; parts=nil; separator="" }
    init(raw text: String) { key=text; values=[:]; raw=true; parts=nil; separator="" }
    init(joining parts: [BridgeText], separator: String = "") { key=""; values=[:]; raw=false; self.parts=parts; self.separator=separator }
    init(error: Error) { self = (error as? BridgeLocalizedError)?.bridgeText ?? BridgeText(raw: error.localizedDescription) }
    func rendered(language: String, catalog: [String: [String: String]]) -> String {
        if let parts { return parts.map { $0.rendered(language:language,catalog:catalog) }.joined(separator:separator) }
        return raw ? key : BridgeStrings.text(key,values:values,language:language,catalog:catalog)
    }
    var localized: String { rendered(language:bridgeLanguage(),catalog:BridgeStrings.catalog) }
}
