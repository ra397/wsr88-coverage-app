
class markerCollection {
    map;
    markers = [];
    isAdvancedMarker = !1;

    markerFill = 'white';
    markerStroke = 'green';
    markerSize = 6;
    initZIndex = 0;
    svgURL = null;

    useAdvancedMarker (u = !1) {
        if (u !== 'undefiined') {
            this.isAdvancedMarker = u;
            if (this.isAdvancedMarker) {
                const {AdvancedMarkerElement} = google.maps.importLibrary("marker");
            }
        }
    }

    constructor (map, use_advanced = !1) {
        this.map = map, this;
        this.isAdvancedMarker = use_advanced;
    }

    async getIconURL () {
        const bc = this.markerStroke, fc = this.markerFill, r = this.markerSize;
        const br = 100 * 1/r, wh = 100 - 2 * br;
        const svg = `<svg stroke-width="1" fill="${fc}" stroke="${bc}" width="${(r) * 2}" height="${(r) * 2}" xmlns="http://www.w3.org/2000/svg" ><rect x="${br}%" y="${br}%"  width="${wh}%" height="${wh}%" rx="50%" ry="50%"/></svg>`;
        const use_img = new Image();

        use_img.src = 'data:image/svg+xml;base64,' + window.btoa(svg);
        let ret = '';

        await fetch(use_img.src)
            .then(response => response.blob())
            .then(blob => {
                ret =  URL.createObjectURL(blob);
            });
        return ret;
    }

    // selectMarker ({k,v})

    setMarkerOptions ({markerFill = null, markerStroke = null, markerSize = null}){
        // const accepted = ['markerFill', 'markerStroke', 'markerSize'];
        this.markerFill = markerFill || this.markerFill;
        this.markerStroke = markerStroke || this.markerStroke;
        this.markerSize = markerSize || this.markerSize;
        // Object.entries(accepted).forEach(
        //     e => {
        //         if (accepted.indexOf(e[0]) > -1) this[e[0]] = e[1];
        //     }
        // )
        return !0;
    }

    async init  ({map = null, use_advanced = !1, marker_options={}}) {
        this.setMarkerOptions(marker_options);
        this.useAdvancedMarker (use_advanced);
        this.map = this.map || map;
        this.isAdvancedMarker = this.isAdvancedMarker || use_advanced
        await this.getIconURL().then(
            (r) => {this.svgURL = r}
        )
        return this
        // return async_result
    }


    markerIcon = ()  => {
        const _advanced = () => {
            const img = new Image()
            img.src = this.svgURL
            return img;
        }
        const _marker = () => {
            return {
                url: this.svgURL,
                size: new google.maps.Size(
                    (this.markerSize) * 2,
                    (this.markerSize) * 2
                ),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(
                    this.markerSize, this.markerSize
                )
            }
        }
        return this.isAdvancedMarker ? _advanced() : _marker();
    }

    async updateIcons ({markerStroke = null, markerFill = null, markerSize = null}){
        console.log (arguments[0])
        if (arguments[0])
            this.setMarkerOptions (arguments[0])
        await this.getIconURL().then(
            (r) => {
                this.svgURL = r;
                let icon;
                for (var i = 0; i < this.markers.length; i++) {
                    // icon = this.markers[i].getIcon()
                    // icon.url = this.svgURL;
                    this.markers[i].setIcon(this.markerIcon())
                }
            }
        )
    }

    makeMarker = (lat, lng, opt={}, evnts={}) => {
        const self = this;
        const use_opt = {
            position: new google.maps.LatLng(lat, lng),
            map: this.map,
            zIndex: this.initZIndex
        }
        let k = 'content', c = google.maps.marker.AdvancedMarkerElement;
        if (!this.isAdvancedMarker) {
            k = 'icon', c = google.maps.Marker;
            Object.entries(opt).forEach(e => use_opt[e[0]] = e[1]);
        }

        use_opt[k] = this.markerIcon();
        const  m = new c (use_opt);

        if (evnts.clickable) {
            m.addListener(
                'click',
                function (ev) {
                    self.reactClick(ev, this)
                },
                !1
            );
        }
        this.markers.push(m)
        return m;
    }

    reactClick  = (ev, marker) => console.log (ev, marker);
    reactMouseOver = (ev, marker) => console.log (ev, marker);
    reactMouseOut  = (ev, marker) => console.log (ev, marker);

    redraw = () => {
        const _advanced = () => {
            for (var i = 0; i < this.markers.length; i++) this.markers[i].content = this.markerIcon()
        };
        const _marker = () => {
            for (var i = 0; i < this.markers.length; i++) this.markers[i].setIcon(this.markerIcon())
        };
        this.getIconURL().then(
            (r) => {
                this.svgURL = r;
                if (this.isAdvancedMarker)
                    _advanced()
                else
                    _marker();
            }
        )
    }
    
    hide = () => {for (var i = 0; i < this.markers.length; i ++) this.markers[i].setMap(null);}
    show = () => {for (var i = 0; i < this.markers.length; i ++) this.markers[i].setMap(this.map);}
}