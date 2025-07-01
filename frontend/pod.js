class POD {
    constructor() {
        this.baseUrl = window._env_.POD_URL;
        this.port = window._env_.POD_PORT;
        this.productName = 'pod';
    }

    // convert JS Date → YYYYMMDD
    _formatDate(dt) {
        const d = dt instanceof Date ? dt : new Date(dt);
        const utcMs     = d.getTime() - d.getTimezoneOffset() * 60000;
        return new Date(utcMs)
        .toISOString()
        .slice(0, 10)
        .replace(/\D/g, '');
    }

    getUrl(dtb, dte) {
        const p1 = `${this._formatDate(dtb)}00`;
        const p2 = `${this._formatDate(dte)}23`;
        return `${this.baseUrl}:${this.port}/hyddatapp`
        + `?param0=${this.productName}`
        + `&param1=${p1}`
        + `&param2=${p2}`;
    }
}

window.POD = POD;