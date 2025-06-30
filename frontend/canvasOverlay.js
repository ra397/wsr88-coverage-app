class CanvasOverlay extends google.maps.OverlayView {
  constructor(bounds, canvas) {
    super();
    this.bounds = bounds;
    this.canvas = canvas;
    this.div = null;
  }

  onAdd() {
    this.div = document.createElement('div');
    this.div.style.borderStyle = 'none';
    this.div.style.position = 'absolute';
    this.div.appendChild(this.canvas);

    const panes = this.getPanes();
    panes.overlayLayer.appendChild(this.div);
  }

  draw() {
    const overlayProjection = this.getProjection();
    const sw = overlayProjection.fromLatLngToDivPixel(
      new google.maps.LatLng(this.bounds.south, this.bounds.west)
    );
    const ne = overlayProjection.fromLatLngToDivPixel(
      new google.maps.LatLng(this.bounds.north, this.bounds.east)
    );

    // Position the div to cover the bounding box
    const div = this.div;
    div.style.left = sw.x + 'px';
    div.style.top = ne.y + 'px';
    div.style.width = (ne.x - sw.x) + 'px';
    div.style.height = (sw.y - ne.y) + 'px';

    // Scale canvas to match
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  onRemove() {
    if (this.div) {
      this.div.parentNode.removeChild(this.div);
      this.div = null;
    }
  }
}