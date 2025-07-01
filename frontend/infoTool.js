infoTool.prototype = new google.maps.OverlayView();

function infoTool(map, latLng, content=undefined) {
    var self = this;
    this.container;
    this.latLng;
    this.gmLayer;
    this.setMap(map);

    this.setContent = (content) => {
        if (this.container !== undefined) this.remove();
        if (typeof content === 'object') {
            this.container = content;
        }
        else {
            this.container = document.createElement('div');
            this.container.innerHTML = content === undefined ? '' : content;
        }
        this.container.style.position = 'absolute';
        this.gmLayer.appendChild(this.container);
        // this.draw();
    }

    this.updateContent = (content) => {
        if (this.container !== undefined) this.gmLayer.removeChild(this.container);
        if (typeof content === 'object') {
            this.container = content;
        }
        else {
            this.container = document.createElement('div');
            this.container.innerHTML = content === undefined ? '' : content;
        }
        this.gmLayer.appendChild(this.container);
        this.container.style.position = 'absolute';
        this.draw();
    }

    this.onAdd = () => {
        this.latLng = latLng
        this.gmLayer = this.getPanes().floatPane
        this.setContent(content);
    }

    this.draw = function () {
        let dxy = this.getProjection().fromLatLngToDivPixel(this.latLng);
        this.container.style.left = `${dxy.x}px`;;
        this.container.style.top = `${dxy.y}px`;
    };

    this.remove = () =>{
        if (!this.gmLayer || !this.container) {
            console.log ("quiting without removing!")
            return;
        }
            this.gmLayer.removeChild(this.container);
            delete this.container ;
            this.latLng = null;
    };
}