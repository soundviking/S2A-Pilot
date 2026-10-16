import Foundation

@main
struct LocaleTests {
    static func main() throws {
        let url = URL(fileURLWithPath: CommandLine.arguments[1])
        let catalog = try JSONDecoder().decode([String: [String: String]].self, from: Data(contentsOf: url))
        precondition(catalog.count >= 300)
        let expected = ["en": ["in 11 s", "Cue at 01:28.000", "S2A Pilot Bridge monitor"], "es": ["en 11 s", "Cue a las 01:28.000", "Monitor de S2A Pilot Bridge"], "de": ["in 11 s", "Cue bei 01:28.000", "S2A Pilot Bridge-Monitor"], "fr": ["dans 11 s", "Cue à 01:28.000", "Visualiseur S2A Pilot Bridge"]]
        for language in bridgeSupportedLanguages {
            func text(_ key: String, _ values: [String: String] = [:]) -> String { BridgeStrings.text(key, values: values, language: language, catalog: catalog) }
            precondition(text("dans {time}", ["time": "11 s"]) == expected[language]![0])
            precondition(text("Cue à {time}", ["time": "01:28.000"]) == expected[language]![1])
            precondition(text("Visualiseur S2A Pilot Bridge") == expected[language]![2])
            let storedError = BridgeText(joining:[BridgeText("Visualiseur indisponible : "),BridgeText("Archive Bridge invalide."),BridgeText(raw:" Nouveau.wav")])
            precondition(storedError.rendered(language:language,catalog:catalog) == text("Visualiseur indisponible : ")+text("Archive Bridge invalide.")+" Nouveau.wav")
            let user = "Nouveau · Lecture · {count} · <&> Äáß"
            precondition(text("Importer « {title} » ?", ["title": user]).contains(user))
            precondition(text(user) == user)
            for (key, row) in catalog { precondition(language == "fr" || row[language] != nil, key) }
        }
        precondition(normalizedBridgeLanguage("de-CH") == "de")
        precondition(normalizedBridgeLanguage("es_MX") == "es")
        print("PASS Bridge: four languages, countdown, Cue time, window title, parameter safety and catalog coverage")
    }
}
