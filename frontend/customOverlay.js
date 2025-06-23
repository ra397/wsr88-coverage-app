(function () {
    function createClass(name, rules){
        var style = document.createElement('style');
        style.type = 'text/css';
        document.getElementsByTagName('head')[0].appendChild(style);
        if(!(style.sheet||{}).insertRule)
            (style.styleSheet || style.sheet).addRule(name, rules);
        else
            style.sheet.insertRule(name+"{"+rules+"}",0);
    }
    createClass('.overlayDiv',"position: absolute; border-style: none; border-width: 0px; image-rendering: pixelated;");
    createClass('.overlayImg',"position: absolute; width: 100%; height: 100%;");
}());

geoOverlay.prototype = new google.maps.GroundOverlay();

function geoOverlay(image, bounds, map) {
    this.set("url", image);
    this.set("bounds", bounds);
    this.setMap(map);
    this.remove = function (){
        this.setMap(null)
    }

    this.setSource = function (src) {
        this.set("url", src);
        this.setMap(map)
    };

    this.animate = function (src) {
        this.set("url", src);
        this.setMap(map)
    };

}

mercatorOverlay.prototype = new google.maps.OverlayView();

function mercatorOverlay(image, bounds, map) {
    this._bounds_ = bounds;
    this._div_ = document.createElement('div');
    this._div_.className = 'overlayDiv';
    this._img_ = new Image();
    this._img_.className = 'overlayImg';
    this._img_.src = image;
    this._div_.appendChild(this._img_);
    this.style = this._div_.style;
    this.projection;
    this.naturalHeight;
    this.naturalWidth;

    this.setMap(map);

    this.onAdd = function () {  // on setMap
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(this._div_);
        this.projection = this.getProjection();
    };

    this.draw = function () {           // on map pan or zoom
        const sw = this.projection.fromLatLngToDivPixel(this._bounds_.getSouthWest()),
        ne = this.projection.fromLatLngToDivPixel(this._bounds_.getNorthEast());

        this.style.left = sw.x + 'px';
        this.style.top = ne.y + 'px';
        this.style.width = (ne.x - sw.x) + 'px';
        this.style.height = (sw.y - ne.y) + 'px';
    };

    this.remove = function (){
        this.setMap(null)
    }

    this.onRemove = function () {
        this._div_.parentNode.removeChild(this._div_);
        this._div_ = null;
    };

    this.setOpacity = function (opacity) {
        this.style.opacity = opacity;
    };

    this.setSource = function (src) {
        this._img_.src = src;
    };

    this.animate = this.setSource;

    this.fromLatLngToColRow = (_latLng) => {
        if (!this._bounds_.contains(_latLng)) return [null, null];
        const nW = this._img_.naturalWidth, nH = this._img_.naturalHeight;
        this.naturalHeight = nH; this.naturalWidth = nW;
        const oL = this._div_.offsetLeft, oT = this._div_.offsetTop;
        const oW = this._div_.offsetWidth, oH = this._div_.offsetHeight
        const xy = this.projection.fromLatLngToDivPixel (_latLng);
        const rW = nW/oW, rH = nH/oH;

        let col = Math.floor(Math.abs(oL - xy.x) * rW);
        let row = Math.floor(Math.abs(oT - xy.y) * rH);
        return [col,row]
    }



}

function customOverlay(imgSrc, bounds, map, overlayType){
    if (typeof(bounds.extend) !== "function" &&
        bounds.hasOwnProperty("sw") &&
        bounds.hasOwnProperty("ne")
    ) bounds = new google.maps.LatLngBounds(bounds.sw, bounds.ne)

    if (overlayType == 'OverlayView') {
        return new mercatorOverlay(
            imgSrc,
            bounds,
            map
        )
    } else if (overlayType == 'GroundOverlay') {
        return new geoOverlay(
            imgSrc,
            bounds,
            map
        )
    } else return false
}