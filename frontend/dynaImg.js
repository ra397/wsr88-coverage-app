class dynaImg {
    width = null;
    height = null;
    scale =1;

    vmin = 0;
    vmax = 1;
    stops = 32;

    values = [];

    useColors = {
        name: '',
        rgba: []
    }
    clrs = []

    histogramCount = [];
    histogramStops = [];

    clampedArray = [];
    offCanvas = new OffscreenCanvas(0, 0);

    urlBlob = null;
    image = null;
    mask = [];
    getValue(c, r){
        let ret = null;
        if (c > -1 &&
            c < this.width &&
            r > -1 &&
            r < this.height &&
            this.values.length > r*this.width + c
        )
            ret = this.values[r*this.width + c]/this.scale;
        return ret
    }

    constructor(w=null, h=null) {
        this.setSize(w, h);
    }

    setSize (w = null, h = null) {
        if (w !== null) this.width = w;
        if (h !== null) this.height = h;
        if (h && w) {
            this.offCanvas.width = this.width, this.offCanvas.height = this.height,
                this.ClampedArray = new Uint8ClampedArray(4 * this.width * this.height),
                this.imageData = new ImageData(this.ClampedArray, this.width, this.height);
        }
    }

    setColors (name, col_arr){
        this.useColors.name = name;
        this.useColors.rgba = col_arr;
    }

    setRange(vmin, vmax) {
        let ret = !1;
        if (this.vmin != vmin ||  this.vmax != vmax) {
            this.vmin = vmin, this.vmax=vmax, ret = !0;
        }
        return ret;
    }

    setStops (stops) {
        let ret = !1;
        if (this.stops != stops) {
            this.stops = stops;
            if (this.values.length > 0) ret = !0;
        }
        return ret;
    }

    removeMask = (m = !0) => {
        this.mask = [...Array(this.width*this.height).keys()].map( v=> m);
    }

    recount () {
        const use_min = Math.floor(this.vmin * this.scale),
            use_max = Math.floor(this.vmax * this.scale),
            dlt_value = (use_max-use_min)/this.stops;
        const n = this.width*this.height;
        this.histogramCount = [0].concat([...Array(this.stops).keys()].map( v=> 0))
        let i, ixt, v;
        for (i = 0; i < n; i++){
            if (this.mask[i]){
                ixt = 0, v = this.values[i];
                if (v > 0 && v > use_min && v < use_max)
                    ixt = Math.floor((v-use_min)/dlt_value) + 1;
                this.histogramCount[ixt] += 1;
            }
        }
    }

    async redraw (){
        const
            use_min = Math.floor(this.vmin * this.scale),
            use_max = Math.floor(this.vmax * this.scale);
        const
            dlt_color = 255/this.stops,
            dlt_value = (use_max-use_min)/this.stops;

        this.clrs = [[0,0,0,0]].concat([...Array(this.stops).keys()].map(
            v=> {
                let ix = Math.min(
                    Math.round((v+1)*dlt_color),
                    this.useColors.rgba.length-1
                )
                return this.useColors.rgba[ix]
            }));
        if (!this.mask || this.mask.lengt == 0)
            this.mask = [...Array(this.width*this.height).keys()].map( v=> !0);
        this.clrs_mask = [];
        this.clrs.forEach((c, i) => {const _c = [...c]; _c[3] = i == 0 ? 0 : 167, this.clrs_mask.push(_c)});
        this.histogramStops =  [0].concat([...Array(this.stops).keys()].map(v => {return Math.round((v) * dlt_value - use_min)}));
        this.histogramCount = [0].concat([...Array(this.stops).keys()].map( v=> 0))

        let i, j, ixt, v, c, err = 0;
        let sm = 0
        for (i = 0; i < this.width*this.height; i++){
            v = this.values[i];
            if (v > 0 && v > use_min && v < use_max)
                ixt = Math.floor((v-use_min)/dlt_value)+1;
            else ixt = 0;
            // this.histogramCount[ixt] += 1
            if (this.mask[i]) this.histogramCount[ixt] += 1;
            // c = this.mask && !this.mask[i] ? this.clrs_mask[ixt] : this.clrs[ixt];
            c = this.clrs[ixt];

            try {
                for (j = 0; j < c.length; j++) this.ClampedArray[j+i*4] = c[j]
            } catch (e) {
                err++;
                if (err < 2999) {
                    console.log (e)
                    console.log (ixt, c, i)
                }
            }
        }
        let s = 0
        this.offCanvas.getContext('2d').putImageData(this.imageData, 0, 0);

        const blob = await this.offCanvas.convertToBlob();
        this.blobUrl = await URL.createObjectURL(blob);
        if (this.image !== null) {
            URL.revokeObjectURL(this.image.src),
            this.image.src = this.blobUrl;
        }
        return this.blobUrl;
    }

    async load (url) {
        console.log ("[dynaPng] Loading data: ", url)
        const req = await getArrayBuffer(url,  { signal: AbortSignal.timeout(2500) })
        const res = await req;

        let w, h, s
        this.values = null;
        this.values = new Uint16Array(res.slice(12,));
        [w, h, s] = new Int32Array(res.slice(0, 12));

        this.setSize(w,h)
        this.scale = s;
        return this.redraw();
    }
}



class boxMask {
    parent = null
    w = null;
    h = null;
    sub = {
        x0: null,
        x1: null,
        y0: null,
        y1: null
    };

    constructor(parent) {
        this.parent = parent;
        this.setBox;
        parent.recount();
    }

    setBox (x0 = null, x1 = null, y0 = null, y1 = null){
        const p = this.parent
        this.sub.x0 = Math.min(x0, x1)
        this.sub.x1 = Math.max(x0, x1);
        this.sub.y0 = Math.min(y0, y1);
        this.sub.y1 = Math.max(y0, y1);
        const n = p.width * p.height;
        p.mask = new Array(n); for (let i = 0; i < n; ++i) p.mask[i] = false;
        let ix = 0, c = 0;
        for (var x = this.sub.x0; x < this.sub.x1; x++){
            for (var y = this.sub.y0; y < this.sub.y1;  y++){
                    p.mask[x + y * p.width] = true;
                c++;
            }
        }
        console.log(c, Math.round(1000*c/n)/100 + "%")
    }
}