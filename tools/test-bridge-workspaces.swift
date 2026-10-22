import Foundation

@main
struct WorkspaceTests {
    static func main() throws {
        let header = "S2A_WORKSPACES_V1\u{1e}"
        let selected = "WORKSPACE-A\u{1f}Spectacle été\u{1f}/tmp/Été/Spectacle.qlab5\u{1e}"
        let other = "WORKSPACE-B\u{1f}Autre spectacle\u{1f}/tmp/Autre.qlab5\u{1e}"
        let query = BridgeWorkspaceQuery.script(id: "WORKSPACE-A")
        precondition(query.contains("set requestedIDs to {\"WORKSPACE-A\"}"))
        precondition(query.range(of:"is not running")!.lowerBound < query.range(of:"tell application")!.lowerBound)
        let absent = try BridgeWorkspaceQuery.parse("S2A_QLAB_NOT_RUNNING\n")
        precondition(absent.isEmpty)
        let empty = try BridgeWorkspaceQuery.parse(header)
        precondition(empty.isEmpty)
        let unsaved = try BridgeWorkspaceQuery.parse(header + "U\u{1f}Sans titre\u{1f}\u{1e}\n")
        precondition(unsaved.count == 1 && unsaved[0].workspacePath.isEmpty && unsaved[0].projectFolder == nil)
        let expected = try BridgeWorkspaceQuery.parse(header + selected)[0]
        var imports: [String] = []
        for snapshot in [header + selected + other, header + other + selected] {
            let current = try BridgeWorkspaceQuery.resolve(id:expected.id) { id in
                precondition(id == expected.id)
                return try BridgeWorkspaceQuery.parse(snapshot)
            }
            imports.append(current.id)
        }
        precondition(imports == [expected.id, expected.id])
        var attempts = 0
        let recovered = try BridgeWorkspaceQuery.resolve(id:expected.id) { _ in
            attempts += 1
            return attempts == 1 ? [] : [expected]
        }
        precondition(recovered == expected && attempts == 2)
        do {
            _ = try BridgeWorkspaceQuery.resolve(id:expected.id) { _ in try BridgeWorkspaceQuery.parse(header + other) }
            fatalError("Must not import into another workspace")
        } catch BridgeWorkspaceQuery.QueryError.workspaceClosed {}
        for malformed in ["", "noise" + header + selected, header + "WORKSPACE-A\u{1f}truncated", header + selected + selected] {
            do { _ = try BridgeWorkspaceQuery.parse(malformed); fatalError("Must reject invalid QLab reply") }
            catch BridgeWorkspaceQuery.QueryError.invalidReply {}
        }
        do {
            _ = try BridgeWorkspaceQuery.resolve(id:expected.id) { _ in throw BridgeWorkspaceQuery.QueryError.invalidReply }
            fatalError("A communication error must remain distinguishable from a closed workspace")
        } catch BridgeWorkspaceQuery.QueryError.invalidReply {}
        if CommandLine.arguments.count > 1 {
            try query.write(toFile:CommandLine.arguments[1], atomically:true, encoding:.utf8)
        }
        print("PASS simulated Bridge workspace lookup: QLab already open, successive imports, reordered workspaces, empty first snapshot, unsaved workspace, real closure and malformed replies")
    }
}
