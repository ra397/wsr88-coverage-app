from calculate_blockage import combine_blockage_masks
from calculate_blockage.constants import DEM_PATH, VCP12, window_size
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from io import BytesIO

def make_png(matrix):
    color = [1.0, 0.0, 0.0, 0.7]  # red with 0.7 opacity
    transparent = [0.0, 0.0, 0.0, 0.0]  # fully transparent

    fig, ax = plt.subplots(figsize=(51.12, 51.12), dpi=100)  # 51.09 * 100 = 5109 pixels
    ax.axis("off")
    ax.imshow(matrix, cmap=ListedColormap([transparent, color]), interpolation="nearest")

    buf = BytesIO()
    plt.savefig(buf, format="png", dpi=100, transparent=True)
    plt.close(fig)
    buf.seek(0)

    return buf


def get_blockage(easting, northing, elevation_angles_deg=None, tower_m=None, agl_threshold_m=None):
    if elevation_angles_deg is None:
        elevation_angles_deg = VCP12
    if tower_m is None:
        tower_m = 30.48  # default tower height in meters
    if agl_threshold_m is None:
        agl_threshold_m = 914.4  # default max altitude in meters (3000 ft)

    coverage = combine_blockage_masks(
        DEM_PATH,
        easting,
        northing,
        elevation_angles_deg,
        tower_m,
        agl_threshold_m,
        window_size
    )
    img_buf = make_png(coverage)
    return img_buf