import CarPlay
import CoreLocation
import MapKit
import UIKit

/// Entry point for CarPlay. The car screen can't show the app's web view, so
/// the car experience is built from CarPlay templates and talks to the same
/// wheretopark.sg API as Android Auto (android/.../car).
///
/// wheretopark.sg is a CarPlay *parking* app. That category has no search or
/// keyboard template, so the car offers parking near the car and near the
/// phone's saved and recent destinations; a new place is searched on the phone.
///
/// Home (list) → carparks on the map (point-of-interest) → rates (information).
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

    private var interfaceController: CPInterfaceController?
    private weak var carScene: CPTemplateApplicationScene?
    private var home: CPListTemplate?

    private let locationManager = CLLocationManager()
    /// Called once with the car's position, or nil if it couldn't be found.
    private var pendingLocation: ((CLLocation?) -> Void)?

    /// The carparks on the point-of-interest template currently shown.
    private var shown: [CarCarpark] = []
    private var shownHasDestination = false

    // MARK: Scene lifecycle

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController) {
        self.interfaceController = interfaceController
        carScene = templateApplicationScene
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters

        let home = CPListTemplate(title: "wheretopark.sg", sections: homeSections())
        self.home = home
        interfaceController.setRootTemplate(home, animated: false, completion: nil)
    }

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didDisconnectInterfaceController interfaceController: CPInterfaceController) {
        self.interfaceController = nil
        home = nil
        pendingLocation = nil
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Saved and recent places may have changed on the phone since last time.
        home?.updateSections(homeSections())
    }

    // MARK: Home

    private func homeSections() -> [CPListSection] {
        let nearMe = CPListItem(text: "Parking near me",
                                detailText: "Carparks around where you are now",
                                image: UIImage(systemName: "location.fill"))
        nearMe.accessoryType = .disclosureIndicator
        // The row shows a spinner until `done` is called.
        nearMe.handler = { [weak self] _, done in
            guard let self else { return done() }
            self.showNearMe(done)
        }

        var sections = [CPListSection(items: [nearMe], header: "Find parking", sectionIndexTitle: nil)]
        // The list holds a limited number of rows; keep each group short.
        var room = max(0, CPListTemplate.maximumItemCount - 1)

        let saved = Array(PhonePlaces.saved().prefix(min(4, room)))
        if !saved.isEmpty {
            room -= saved.count
            sections.append(CPListSection(items: saved.map { row($0, symbol: "star.fill") },
                                          header: "Saved", sectionIndexTitle: nil))
        }
        let savedNames = Set(saved.map { $0.label.lowercased() })
        let recents = Array(PhonePlaces.recents()
            .filter { !savedNames.contains($0.label.lowercased()) }
            .prefix(min(4, room)))
        if !recents.isEmpty {
            sections.append(CPListSection(items: recents.map { row($0, symbol: "clock.arrow.circlepath") },
                                          header: "Recent", sectionIndexTitle: nil))
        }
        if saved.isEmpty && recents.isEmpty {
            let hint = CPListItem(text: "Search a place on your phone first",
                                  detailText: "Your saved and recent destinations show up here")
            hint.isEnabled = false
            sections.append(CPListSection(items: [hint], header: "Destinations", sectionIndexTitle: nil))
        }
        return sections
    }

    private func row(_ destination: CarDestination, symbol: String) -> CPListItem {
        let item = CPListItem(text: destination.label, detailText: nil, image: UIImage(systemName: symbol))
        item.accessoryType = .disclosureIndicator
        item.handler = { [weak self] _, done in
            guard let self else { return done() }
            self.showCarparks(near: destination, nearMe: false, done)
        }
        return item
    }

    // MARK: Results

    private func showNearMe(_ done: @escaping () -> Void) {
        locate { [weak self] location in
            guard let self else { return done() }
            guard let location else {
                done()
                let denied = [.denied, .restricted].contains(self.locationManager.authorizationStatus)
                self.alert(denied
                    ? "Allow location for wheretopark.sg on your iPhone to find parking near you"
                    : "Couldn't get your location. Pick a saved or recent destination.")
                return
            }
            self.showCarparks(near: CarDestination(label: "you", coordinate: location.coordinate), nearMe: true, done)
        }
    }

    private func showCarparks(near destination: CarDestination, nearMe: Bool, _ done: @escaping () -> Void) {
        // A point-of-interest template shows at most 12 places.
        CarApi.nearby(destination.coordinate, label: nearMe ? nil : destination.label, limit: 12) { [weak self] result in
            done()
            guard let self else { return }
            switch result {
            case .failure(let error):
                self.alert(error.message)
            case .success(let carparks) where carparks.isEmpty:
                self.alert("No carparks found within 600 m")
            case .success(let carparks):
                self.shown = carparks
                self.shownHasDestination = !nearMe
                let template = CPPointOfInterestTemplate(
                    title: nearMe ? "Parking near you" : "Parking near \(destination.label)",
                    pointsOfInterest: carparks.map { self.pointOfInterest($0) },
                    selectedIndex: 0)
                template.pointOfInterestDelegate = self
                self.interfaceController?.pushTemplate(template, animated: true, completion: nil)
            }
        }
    }

    private func pointOfInterest(_ carpark: CarCarpark) -> CPPointOfInterest {
        var where_: [String] = []
        if let meters = carpark.distanceM { where_.append(Self.distance(meters)) }
        if shownHasDestination, let walk = carpark.walkMin { where_.append("\(walk) min walk") }
        let summary = where_.joined(separator: " · ")

        let poi = CPPointOfInterest(
            location: mapItem(carpark),
            title: carpark.name,
            subtitle: Self.summary(carpark),
            summary: summary,
            detailTitle: carpark.name,
            detailSubtitle: Self.summary(carpark),
            detailSummary: ([summary] + (carpark.rateLines ?? []).prefix(2)).filter { !$0.isEmpty }.joined(separator: "\n"),
            pinImage: nil)
        poi.primaryButton = CPTextButton(title: "Navigate", textStyle: .confirm) { [weak self] _ in
            self?.navigate(to: carpark)
        }
        poi.secondaryButton = CPTextButton(title: "Rates", textStyle: .normal) { [weak self] _ in
            self?.showDetails(carpark)
        }
        return poi
    }

    /// Price for the stay, free lots, rates, height limit and EV charging.
    private func showDetails(_ carpark: CarCarpark) {
        var items = [CPInformationItem(title: "\(CarApi.stayHours) hours", detail: carpark.cost.map(Self.price) ?? "Rates unknown")]
        if let free = carpark.lotsAvailable {
            let lots = free == 0 ? "Full right now" : "\(free)" + (carpark.lotsTotal.map { " of \($0)" } ?? "") + " free"
            items.append(CPInformationItem(title: "Lots", detail: lots))
        }
        if shownHasDestination, let walk = carpark.walkMin {
            items.append(CPInformationItem(title: "Walk", detail: "\(walk) min to your destination"))
        }
        for (i, line) in (carpark.rateLines ?? []).prefix(3).enumerated() {
            items.append(CPInformationItem(title: i == 0 ? "Rates" : nil, detail: line))
        }
        if let height = carpark.heightLimitM {
            items.append(CPInformationItem(title: "Height limit", detail: String(format: "%.1f m", height)))
        }
        if let total = carpark.evTotal, total > 0 {
            items.append(CPInformationItem(title: "EV charging",
                                           detail: carpark.evAvailable.map { "\($0) of \(total) free" } ?? "Available"))
        }
        let navigate = CPTextButton(title: "Navigate", textStyle: .confirm) { [weak self] _ in
            self?.navigate(to: carpark)
        }
        let template = CPInformationTemplate(title: carpark.name, layout: .leading, items: items, actions: [navigate])
        interfaceController?.pushTemplate(template, animated: true, completion: nil)
    }

    /// Hand the carpark's location to Apple Maps on the car screen.
    private func navigate(to carpark: CarCarpark) {
        guard let carScene else { return }
        mapItem(carpark).openInMaps(
            launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving],
            from: carScene, completionHandler: nil)
    }

    private func mapItem(_ carpark: CarCarpark) -> MKMapItem {
        let item = MKMapItem(placemark: MKPlacemark(coordinate: carpark.coordinate))
        item.name = carpark.name
        return item
    }

    // MARK: Formatting

    /// "$3.50 for 2 h · 120 free"
    private static func summary(_ carpark: CarCarpark) -> String {
        var parts = [carpark.cost.map { "\(price($0)) for \(CarApi.stayHours) h" } ?? "Rates unknown"]
        if let free = carpark.lotsAvailable { parts.append(free == 0 ? "Full" : "\(free) free") }
        return parts.joined(separator: " · ")
    }

    private static func price(_ dollars: Double) -> String {
        String(format: "$%.2f", dollars)
    }

    private static func distance(_ meters: Double) -> String {
        meters < 1000 ? "\(Int(meters.rounded())) m" : String(format: "%.1f km", meters / 1000)
    }

    private func alert(_ message: String) {
        let ok = CPAlertAction(title: "OK", style: .cancel) { [weak self] _ in
            self?.interfaceController?.dismissTemplate(animated: true, completion: nil)
        }
        interfaceController?.presentTemplate(CPAlertTemplate(titleVariants: [message], actions: [ok]),
                                             animated: true, completion: nil)
    }
}

// MARK: - Map

extension CarPlaySceneDelegate: CPPointOfInterestTemplateDelegate {
    /// The list is the carparks around one destination; panning the map
    /// doesn't start a new search.
    func pointOfInterestTemplate(_ pointOfInterestTemplate: CPPointOfInterestTemplate,
                                 didChangeMapRegion region: MKCoordinateRegion) {}
}

// MARK: - Location

extension CarPlaySceneDelegate: CLLocationManagerDelegate {
    /// The phone's location, asking for permission (on the phone) if needed.
    private func locate(_ completion: @escaping (CLLocation?) -> Void) {
        // A fix from the last two minutes is good enough to search around.
        if let last = locationManager.location, last.timestamp.timeIntervalSinceNow > -120 {
            return completion(last)
        }
        pendingLocation = completion
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization() // continues in didChangeAuthorization
        case .denied, .restricted:
            finishLocating(nil)
        default:
            locationManager.requestLocation()
        }
    }

    private func finishLocating(_ location: CLLocation?) {
        let completion = pendingLocation
        pendingLocation = nil
        completion?(location)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard pendingLocation != nil else { return }
        switch manager.authorizationStatus {
        case .notDetermined: break
        case .denied, .restricted: finishLocating(nil)
        default: manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        finishLocating(locations.last)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        finishLocating(manager.location)
    }
}
