import Foundation
import UIKit
import AppIntents
import Capacitor

/* v1.51: Start / Stop Fasting from the Home Screen menu (long-press the icon) and from Siri.

   The habits live in the web view's storage, which native code cannot change. So the two sides
   hand over through UserDefaults:
   - the page tells this side, on every save, how the fasting habit stands (AMSFasting.setStatus):
     its name, when the running fast began (or none), its goals;
   - Siri and the menu add steps ("start" / "stop" with the moment they were asked) to a queue;
   - the page takes the queue (AMSFasting.takePending) when it starts, when it comes back to the
     front and when it is told a step arrived, and applies the steps in order.
   Siri reads status + queue to answer at once, without opening the app. */

enum FastingStore {
    static let statusKey = "ams.fasting.status"
    static let pendingKey = "ams.fasting.pending"
    static let pendingArrived = Notification.Name("AMSFastingPendingArrived")
    static let startItem = "ams.fast.start"
    static let stopItem = "ams.fast.stop"

    /// What the page last said. `habit` is nil when there is no fasting habit.
    struct Status: Codable {
        var habit: String?
        var since: Double?          // ms since 1970 when the running fast began; nil = none running
        var goalH: Double?          // the running fast's goal in hours
        var goalHours: Double?      // the habit's goal
        var goalByDay: [Double?]?   // Monday-first per-weekday goals (optional)
    }

    struct Step: Codable {
        var a: String               // "start" | "stop"
        var t: Double               // ms since 1970
        var src: String             // "siri" | "menu"
    }

    private static let lock = NSLock()
    private static var defaults: UserDefaults { .standard }

    static func status() -> Status? {
        guard let data = defaults.data(forKey: statusKey) else { return nil }
        return try? JSONDecoder().decode(Status.self, from: data)
    }

    static func setStatus(_ status: Status) {
        lock.lock()
        if let data = try? JSONEncoder().encode(status) { defaults.set(data, forKey: statusKey) }
        lock.unlock()
        refreshQuickActions()
    }

    private static func readPending() -> [Step] {
        guard let data = defaults.data(forKey: pendingKey) else { return [] }
        return (try? JSONDecoder().decode([Step].self, from: data)) ?? []
    }

    static func append(_ step: Step) {
        lock.lock()
        var steps = readPending()
        steps.append(step)
        if steps.count > 50 { steps.removeFirst(steps.count - 50) }
        if let data = try? JSONEncoder().encode(steps) { defaults.set(data, forKey: pendingKey) }
        lock.unlock()
        refreshQuickActions()
        NotificationCenter.default.post(name: pendingArrived, object: nil)
    }

    static func takePending() -> [Step] {
        lock.lock()
        let steps = readPending()
        defaults.removeObject(forKey: pendingKey)
        lock.unlock()
        return steps
    }

    /// How things stand once the waiting steps are applied — the same rules as the page's
    /// applyFastAction(): a start while a fast runs does nothing, a stop needs a running fast
    /// that began before it.
    static func effective() -> (status: Status?, since: Double?) {
        lock.lock()
        let st = status()
        let steps = readPending().sorted { $0.t < $1.t }
        lock.unlock()
        var since = st?.since
        for s in steps {
            if s.a == "start", since == nil { since = s.t }
            else if s.a == "stop", let b = since, s.t > b { since = nil }
        }
        return (st, since)
    }

    /// The goal for a fast that began at `start`: its own when the page sent one for the running
    /// fast, else the weekday goal of the day it is expected to end (an afternoon or evening start
    /// ends tomorrow) — the page's goalDayFor().
    static func goalHours(_ st: Status, start: Double, isRunningFromPage: Bool) -> Double? {
        if isRunningFromPage, let g = st.goalH, g > 0 { return g }
        let s = Date(timeIntervalSince1970: start / 1000)
        let cal = Calendar.current
        let day = cal.component(.hour, from: s) >= 12 ? (cal.date(byAdding: .day, value: 1, to: s) ?? s) : s
        let mondayFirst = (cal.component(.weekday, from: day) + 5) % 7   // Sunday = 1 → 6, Monday = 2 → 0
        if let byDay = st.goalByDay, mondayFirst < byDay.count, let g = byDay[mondayFirst], g > 0 { return g }
        if let g = st.goalHours, g > 0 { return g }
        return nil
    }

    // MARK: words

    static func clock(_ ms: Double) -> String {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        return f.string(from: Date(timeIntervalSince1970: ms / 1000))
    }

    static func hours(_ ms: Double) -> String {
        let min = max(0, Int(ms / 60000))
        let h = min / 60, m = min % 60
        if h == 0 { return "\(m) min" }
        return m == 0 ? "\(h) h" : "\(h) h \(m) min"
    }

    static func number(_ g: Double) -> String {
        g == g.rounded() ? String(Int(g)) : String(format: "%.1f", g)
    }

    // MARK: Siri

    static let notOpenedYet = "Open Tracking once, then try again."
    static let noHabit = "Tracking has no fasting habit."

    static func startBySiri() -> String {
        let (st, since) = effective()
        guard let st = st else { return notOpenedYet }
        guard st.habit != nil else { return noHabit }
        let now = Date().timeIntervalSince1970 * 1000
        if let b = since {
            return "You are already fasting, since \(clock(b)) — \(hours(now - b))."
        }
        append(Step(a: "start", t: now, src: "siri"))
        var words = "Fast started at \(clock(now))."
        if let g = goalHours(st, start: now, isRunningFromPage: false) {
            words += " Goal \(number(g)) h, until \(clock(now + g * 3600_000))."
        }
        return words
    }

    static func stopBySiri() -> String {
        let (st, since) = effective()
        guard let st = st else { return notOpenedYet }
        guard st.habit != nil else { return noHabit }
        guard let b = since else { return "No fast is running." }
        let now = Date().timeIntervalSince1970 * 1000
        append(Step(a: "stop", t: now, src: "siri"))
        var words = "Fast ended after \(hours(now - b))."
        let fromPage = st.since != nil && st.since == b
        if let g = goalHours(st, start: b, isRunningFromPage: fromPage) {
            words += now - b >= g * 3600_000
                ? " Goal of \(number(g)) h met."
                : " Goal was \(number(g)) h."
        }
        return words
    }

    // MARK: Home Screen menu

    /// One item, the one that fits: Start Fasting, or Stop Fasting with when it began.
    static func refreshQuickActions() {
        let (st, since) = effective()
        let items: [UIApplicationShortcutItem]
        if st?.habit == nil {
            items = []
        } else if let b = since {
            items = [UIApplicationShortcutItem(type: stopItem, localizedTitle: "Stop Fasting",
                                               localizedSubtitle: "Since \(clock(b))",
                                               icon: UIApplicationShortcutIcon(templateImageName: "QuickStop"),
                                               userInfo: nil)]
        } else {
            items = [UIApplicationShortcutItem(type: startItem, localizedTitle: "Start Fasting",
                                               localizedSubtitle: nil,
                                               icon: UIApplicationShortcutIcon(templateImageName: "QuickStart"),
                                               userInfo: nil)]
        }
        DispatchQueue.main.async { UIApplication.shared.shortcutItems = items }
    }

    /// A tap in the menu: hand it to the page, which answers with its usual message and Undo.
    @discardableResult
    static func handle(_ item: UIApplicationShortcutItem) -> Bool {
        let now = Date().timeIntervalSince1970 * 1000
        switch item.type {
        case startItem: append(Step(a: "start", t: now, src: "menu"))
        case stopItem: append(Step(a: "stop", t: now, src: "menu"))
        default: return false
        }
        return true
    }
}

// MARK: - Siri and the Shortcuts app

struct StartFastingIntent: AppIntent {
    static let title: LocalizedStringResource = "Start Fasting"
    static let description = IntentDescription("Starts a fast in Tracking now, without opening the app.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let words = FastingStore.startBySiri()
        return .result(dialog: "\(words)")
    }
}

struct StopFastingIntent: AppIntent {
    static let title: LocalizedStringResource = "Stop Fasting"
    static let description = IntentDescription("Ends the running fast in Tracking now, without opening the app.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let words = FastingStore.stopBySiri()
        return .result(dialog: "\(words)")
    }
}

/// Ready without any setup: "Hey Siri, start fasting in Tracking". They also appear in the
/// Shortcuts app under Tracking, in Spotlight and for the Action button.
struct TrackingShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: StartFastingIntent(), phrases: [
            "Start fasting in \(.applicationName)",
            "Start a fast in \(.applicationName)",
            "Start my fast in \(.applicationName)",
            "Start fasting with \(.applicationName)",
            "\(.applicationName) start fasting"
        ], shortTitle: "Start Fasting", systemImageName: "moon")
        AppShortcut(intent: StopFastingIntent(), phrases: [
            "Stop fasting in \(.applicationName)",
            "End my fast in \(.applicationName)",
            "Stop my fast in \(.applicationName)",
            "Stop fasting with \(.applicationName)",
            "\(.applicationName) stop fasting"
        ], shortTitle: "Stop Fasting", systemImageName: "fork.knife")
    }
    static let shortcutTileColor: ShortcutTileColor = .purple
}

// MARK: - The page's side (Capacitor plugin "AMSFasting")

@objc(AMSFastingPlugin)
public class AMSFastingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AMSFastingPlugin"
    public let jsName = "AMSFasting"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePending", returnType: CAPPluginReturnPromise)
    ]
    private var observer: NSObjectProtocol?

    override public func load() {
        observer = NotificationCenter.default.addObserver(forName: FastingStore.pendingArrived,
                                                          object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("pending", data: [:])
        }
    }

    deinit {
        if let o = observer { NotificationCenter.default.removeObserver(o) }
    }

    @objc func setStatus(_ call: CAPPluginCall) {
        let byDay = (call.getArray("goalByDay") ?? []).map { v -> Double? in
            if let d = v as? Double { return d }
            if let n = v as? NSNumber { return n.doubleValue }
            return nil
        }
        FastingStore.setStatus(FastingStore.Status(
            habit: call.getString("habit"),
            since: call.getDouble("since"),
            goalH: call.getDouble("goalH"),
            goalHours: call.getDouble("goalHours"),
            goalByDay: byDay.isEmpty ? nil : byDay))
        call.resolve()
    }

    @objc func takePending(_ call: CAPPluginCall) {
        let steps = FastingStore.takePending().map { ["a": $0.a, "t": $0.t, "src": $0.src] as [String: Any] }
        call.resolve(["steps": steps])
    }
}

/// The app's web view controller: Capacitor's, plus the in-app plugin above.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AMSFastingPlugin())
    }
}
