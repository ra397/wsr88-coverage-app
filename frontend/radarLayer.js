class RadarLayer {
    constructor(map, radar_sites_path, radar_coverage_path) {
        this.map = map;

        this.radar_sites_path = radar_sites_path;
        this.radar_coverage_path = radar_coverage_path;

        this.halfExtent = window.constants.radar.halfExtent;

        this.precalculatedRadarSitesMarkers = new markerCollection(this.map);
        this.dynamicRadarSitesMarkers = new markerCollection(this.map);

        this.precalcOverlay = {};
        this.dynamicOverlay = {};
    }

    async init() {
        await this.precalculatedRadarSitesMarkers.init({
            marker_options: {
                markerFill: 'red',
                markerStroke: 'red',
                markerSize: 3.5
            }
        });

        await this.dynamicRadarSitesMarkers.init({
            marker_options: {
                markerFill: 'purple',
                markerStroke: 'purple',
                markerSize: 3.5
            }
        })

        this.precalculatedRadarSitesMarkers.reactClick = this.precalculatedRadarSiteClicked.bind(this);
        this.dynamicRadarSitesMarkers.reactClick = this.dynamicRadarSiteClicked.bind(this);
        
        this.loadPrecalculatedRadarSites();
    }

    // Loads the radar sites from a GeoJSON file and creates markers for each site
    loadPrecalculatedRadarSites() {
        fetch(this.radar_sites_path)
        .then(response => response.json())
        .then(data => {
            for (let i = 0; i < data.features.length; i++) {
                const description = data.features[i].properties.description;
                const siteData = this._extractSiteData(description);
                const coords = {
                    latitude: siteData.latitude,
                    longitude: siteData.longitude,
                };

                this.precalculatedRadarSitesMarkers.makeMarker(
                    coords.latitude,
                    coords.longitude,
                    {
                    properties: {
                        siteID : siteData.siteId,
                        easting: data.features[i].geometry.coordinates[0],
                        northing: data.features[i].geometry.coordinates[1],
                        elevation: siteData.elevation,
                    },
                    clickable: true,
                    optimized: true
                    },
                    {
                    clickable: true,
                    mouseOver: false,
                    mouseOut: false
                    }
                );
            }
        });
    }

    precalculatedRadarSiteClicked(event, marker) {
        const siteID = marker.properties.siteID;
        if (this.precalcOverlay[siteID]) {
            // If overlay already exists for this site, remove it
            this.precalcOverlay[siteID].setMap(null);
            delete this.precalcOverlay[siteID];
            return;
        }
        this._addPrecalculatedOverlay(marker);
    }

    _addPrecalculatedOverlay(marker) {
        const {siteID, easting, northing, elevation} = marker.properties;
        const overlayBounds = this._getOverlayBounds(easting, northing);
        const url = `${this.radar_coverage_path}/coverages_3k/${siteID}.png`;
        const overlay = new google.maps.GroundOverlay(url, overlayBounds, {
            opacity: 0.7,
            clickable: false,
        });
        overlay.setMap(this.map);
        this.precalcOverlay[siteID] = overlay;
    }

    showAllPrecalculatedCoverages() {

    }

    getCoverage(lat, lng, maxAlt, towerHeight, elevationAngles) {
        const marker = this._addDynamicMarker(lat, lng);
        this._sendCoverageRequest(marker, lat, lng, maxAlt, towerHeight, elevationAngles);
    }

    _addDynamicMarker(lat, lng) {
        // Add marker to dynamic radars marker collection
        const marker = this.dynamicRadarSitesMarkers.makeMarker(
            lat,
            lng,
            {
                properties: {
                    siteID: `${lat}${lng}`,
                },
                clickable: true
            },
            {clickable: true}
        );
        return marker;
    }

    async _sendCoverageRequest(marker, lat, lng, maxAlt, towerHeight, elevationAngles) {
        // Convert to epsg:3857
        const [x3857, y3857] = proj4('EPSG:4326', 'EPSG:3857', [lng, lat]);

        const payload = {
            easting: x3857,
            northing: y3857,
            max_alt_m : maxAlt,
            tower_m : towerHeight,
            elevation_angles : elevationAngles,
        }
        
        const serverUrl = window._env_dev.SERVER_URL;
        const response = await fetch(`${serverUrl}/calculate_blockage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
        });
        const blob = await response.blob();
        const imgUrl = URL.createObjectURL(blob);
        const overlayBounds = this._getOverlayBounds(x3857, y3857);
        const overlay = new google.maps.GroundOverlay(imgUrl, overlayBounds, {
            opacity: 0.7,
            clickable: false
        });
        overlay.setMap(this.map);
        this.dynamicOverlay[marker.properties.siteID] = overlay;
    }

    dynamicRadarSiteClicked(event, marker) {
        const siteID = marker.properties.siteID;
        const overlay = this.dynamicOverlay[siteID];
        if (!overlay) {
            console.warn(`No overlay found for dynamic site ${siteID}`);
            return;
        }
        const isVisible = overlay.getMap() !== null;
        if (isVisible) {
            overlay.setMap(null); // Hide
        } else {
            overlay.setMap(this.map); // Show again
        }
    }

    // Helper: extracts site data from the description
    _extractSiteData(description) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(description, 'text/html');
        const tdElements = Array.from(doc.querySelectorAll('td'));

        let siteId = null;
        let latitude = null;
        let longitude = null;
        let elevation = null;

        tdElements.forEach(td => {
            const text = td.textContent.trim();

            if (text.startsWith("SITE ID")) {
            const match = text.match(/NEXRAD:([A-Z0-9]+)/);
            if (match) siteId = match[1];
            } else if (text.startsWith("LATITUDE")) {
            latitude = parseFloat(text.replace("LATITUDE", "").trim());
            } else if (text.startsWith("LONGITUDE")) {
            longitude = parseFloat(text.replace("LONGITUDE", "").trim());
            } else if (text.startsWith("ELEVATION")) {
            elevation = parseFloat(text.replace("ELEVATION", "").trim());
            }
        });
        return { siteId, latitude, longitude, elevation };
    }

    _getOverlayBounds(x3857, y3857) {
        const bounds3857 = {
            west: x3857 - this.halfExtent,
            east: x3857 + this.halfExtent,
            south: y3857 - this.halfExtent,
            north: y3857 + this.halfExtent
        };
        const [westLng, southLat] = proj4('EPSG:3857', 'EPSG:4326', [bounds3857.west, bounds3857.south]);
        const [eastLng, northLat] = proj4('EPSG:3857', 'EPSG:4326', [bounds3857.east, bounds3857.north]);
        return { north: northLat, south: southLat, east: eastLng, west: westLng };
    }
}

window.RadarLayer = RadarLayer;