import ExpoModulesCore
import WidgetKit

public class WidgetSyncModule: Module {
    public func definition() -> ModuleDefinition {
        Name("WidgetSync")

        /// Write the latest app state to shared UserDefaults and reload the widget timeline.
        /// Accepts a JSON-serializable dictionary matching the WidgetData contract.
        AsyncFunction("syncData") { (payload: [String: Any]) in
            guard let suite = UserDefaults(suiteName: "group.com.titrahealth.app") else {
                throw NSError(domain: "WidgetSync", code: 1, userInfo: [
                    NSLocalizedDescriptionKey: "Failed to access App Group UserDefaults"
                ])
            }

            // Re-serialize the dictionary to JSON Data for storage
            let jsonData = try JSONSerialization.data(withJSONObject: payload, options: [])
            suite.set(jsonData, forKey: "widget_data")
            suite.synchronize()

            // Tell WidgetKit to refresh
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }

        /// Force-reload widget timelines without writing new data.
        /// Useful after background fetches or push notifications.
        AsyncFunction("reloadTimelines") {
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }
}
