import CoreLocation
import Foundation

/// A destination the person picked: a saved place, a recent, or where the car is.
struct CarDestination {
    let label: String
    let coordinate: CLLocationCoordinate2D
}

/// A carpark as /api/car/nearby returns it, already priced for the stay.
struct CarCarpark: Decodable {
    let id: String
    let name: String
    let subtitle: String?
    let lat: Double
    let lng: Double
    let distanceM: Double?
    let walkMin: Int?
    let cost: Double?
    let lotsAvailable: Int?
    let lotsTotal: Int?
    let heightLimitM: Double?
    let evAvailable: Int?
    let evTotal: Int?
    let rateLines: [String]?

    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lng) }
}

/// The wheretopark.sg endpoint the CarPlay screens use: the same one Android
/// Auto calls (android/.../car/CarApi.java). Completions arrive on the main queue.
enum CarApi {
    static let base = "https://wheretopark.sg"
    /// The car prices every carpark for a 2-hour stay, as Android Auto does.
    static let stayHours = 2

    private struct NearbyResponse: Decodable {
        let ok: Bool?
        let error: String?
        let carparks: [CarCarpark]?
    }

    /// Carparks around a point, cheapest first. `label` (a searched place, nil
    /// for "near me") pins that place's own carpark first, as the phone does.
    static func nearby(_ coordinate: CLLocationCoordinate2D, label: String?, limit: Int,
                       completion: @escaping (Result<[CarCarpark], CarApiError>) -> Void) {
        var components = URLComponents(string: base + "/api/car/nearby")!
        components.queryItems = [
            URLQueryItem(name: "lat", value: String(coordinate.latitude)),
            URLQueryItem(name: "lng", value: String(coordinate.longitude)),
            URLQueryItem(name: "hours", value: String(stayHours)),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let label { components.queryItems?.append(URLQueryItem(name: "label", value: label)) }

        var request = URLRequest(url: components.url!, timeoutInterval: 12)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        URLSession.shared.dataTask(with: request) { data, _, _ in
            let result: Result<[CarCarpark], CarApiError>
            if let data {
                if let body = try? JSONDecoder().decode(NearbyResponse.self, from: data) {
                    if body.ok == false {
                        result = .failure(CarApiError(message: body.error ?? "Something went wrong"))
                    } else {
                        result = .success(body.carparks ?? [])
                    }
                } else {
                    result = .failure(CarApiError(message: "Unexpected response from wheretopark.sg"))
                }
            } else {
                result = .failure(CarApiError(message: "No connection. Try again in a moment."))
            }
            DispatchQueue.main.async { completion(result) }
        }.resume()
    }
}

struct CarApiError: Error {
    let message: String
}

/// Saved and recent destinations from the phone app. The web app mirrors them
/// to Capacitor Preferences (src/lib/storage.ts), which keeps them in
/// UserDefaults under a "CapacitorStorage." prefix, so the car can offer them
/// without signing in.
enum PhonePlaces {
    static func saved() -> [CarDestination] { read("psg.savedDestinations") }
    static func recents() -> [CarDestination] { read("psg.recents") }

    private static func read(_ key: String) -> [CarDestination] {
        guard let raw = UserDefaults.standard.string(forKey: "CapacitorStorage." + key),
              let array = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [[String: Any]]
        else { return [] }
        var seen = Set<String>()
        return array.compactMap { item in
            // Entries without coordinates (older saves) can't be searched from the car.
            guard let lat = (item["lat"] as? NSNumber)?.doubleValue,
                  let lng = (item["lng"] as? NSNumber)?.doubleValue,
                  let name = (item["name"] as? String)?.trimmingCharacters(in: .whitespaces),
                  !name.isEmpty, seen.insert(name.lowercased()).inserted
            else { return nil }
            return CarDestination(label: name, coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng))
        }
    }
}
