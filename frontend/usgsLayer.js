class UsgsLayer {
    constructor(map) {
        this.map = map;

        this.usgsSitesMarkers = new markerCollection(this.map);
    }

    async init() {
        await this.usgsSitesMarkers.init({
            marker_options: {
                markerFill: "green",
                markerStroke: "green",
                markerSize: 3.5
            }
        });
        this.usgsSitesMarkers.reactClick = this.usgsSiteClicked.bind(this);
        this.loadUsgsSites();
    }

    loadUsgsSites() {
        const url = window._env_dev.USGS_SITES_URL;
        getArrayBuffer(url).then((ret) => {
            const pbf = new Pbf(ret);
            const geojson = geobuf.decode(pbf);  // Converts to GeoJSON

            for (let i = 0; i < geojson.features.length; i++) {
                const f = geojson.features[i];
                const c = f.geometry.coordinates;

                // Skip small basins
                if (1 * f.properties.drainage_area < 100) continue;

                this.usgsSitesMarkers.makeMarker(
                    c[1], // latitude
                    c[0], // longitude
                    {
                        properties: f.properties,
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
            this.usgsSitesMarkers.hide();
        });        
    }

    showUsgsSites() {
        this.usgsSitesMarkers.show();
    }

    hideUsgsSites() {
        this.usgsSitesMarkers.hide();
    }

    usgsSiteClicked(event, marker) {
        console.log("Inside UsgsLayer: " + marker.properties.usgs_id);

    }

    _getArrayBuffer(url) {
        return fetch(url).then(response => response.arrayBuffer());
    }

}

window.UsgsLayer = UsgsLayer;