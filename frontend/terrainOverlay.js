class ShadedRelief {
    constructor(tileSize) {
        this.tileSize = tileSize;
        this.maxZoom = 19;
        this.name = "Terrain Overlay";
        this.alt = "Terrain Overlay";
        this.tiles = [];
        this.isActive = false;
        this.map = null;
    }

    getTile(coord, zoom, ownerDocument) {
        const div = ownerDocument.createElement("div");
        const img = ownerDocument.createElement("img");
        div.className = "terrain-overlay";
        div.style.display = this.isActive ? 'block' : 'none';
        img.src = `https://mt1.google.com/vt/lyrs=t&x=${coord.x}&y=${coord.y}&z=${zoom}`;
        div.appendChild(img);
        this.tiles.push(div);
        return div;
    }

    releaseTile(tile) {
        tile.innerHTML = '';
        const index = this.tiles.indexOf(tile);
        if (index > -1) {
            this.tiles.splice(index, 1);
        }
    }

    setMap(map) {
        if (map === null && this.map) {
            // Remove from overlayMapTypes
            const overlayMapTypes = this.map.overlayMapTypes;
            for (let i = overlayMapTypes.getLength() - 1; i >= 0; i--) {
                if (overlayMapTypes.getAt(i) === this) {
                    overlayMapTypes.removeAt(i);
                    break;
                }
            }
            this.isActive = false;
            this.map = null;
        } else if (map) {
            // Add to overlayMapTypes
            this.map = map;
            this.isActive = true;
            map.overlayMapTypes.push(this);
        }
        
        // Update existing tiles
        this.tiles.forEach(tile => {
            tile.style.display = this.isActive ? 'block' : 'none';
        });
    }
}

// Event listener for terrain overlay checkbox
document.getElementById("shadedRelief-checkbox").addEventListener("change", function () {
    if (this.checked) {
        shadedRelief.setMap(window.map);
    } else {
        shadedRelief.setMap(null);
    }
});

function addShadedReliefStyles() {
    const style = document.createElement('style');
    style.textContent = `
        div.terrain-overlay {
            width: 256px;
            height: 256px;     
            filter: brightness(5) sepia(1) invert(1);
            opacity: 0.2;
        }
        div.terrain-overlay > img {
            image-rendering: smooth;
        }
    `;
    document.head.appendChild(style);
}

window.ShadedRelief = ShadedRelief;
window.addShadedReliefStyles = addShadedReliefStyles;