from osgeo import gdal
from calculate_blockage.constants import DEM_PATH

def write_pgw(easting, northing, filename='visibility'):
    # Open DEM and get transform
    ds = gdal.Open(DEM_PATH)
    gt = ds.GetGeoTransform()
    inv_gt = gdal.InvGeoTransform(gt)

    # Convert (easting, northing) to pixel
    px, py = gdal.ApplyGeoTransform(inv_gt, easting, northing)
    center_col = int(round(px))
    center_row = int(round(py))

    # Get top-left pixel of the window
    half = 5112 // 2
    top_left_col = center_col - half
    top_left_row = center_row - half

    # Get coordinates of center of top-left pixel
    top_left_x = gt[0] + top_left_col * gt[1] + gt[1] / 2
    top_left_y = gt[3] + top_left_row * gt[5] + gt[5] / 2

    # Write PGW
    pgw_path = f"{filename}.pgw"
    with open(pgw_path, 'w') as f:
        f.write(f"{gt[1]:.10f}\n")   # pixel width
        f.write("0.0000000000\n")   # rotation x
        f.write("0.0000000000\n")   # rotation y
        f.write(f"{gt[5]:.10f}\n")   # negative pixel height
        f.write(f"{top_left_x:.10f}\n")  # x of center of upper-left pixel
        f.write(f"{top_left_y:.10f}\n")  # y of center of upper-left pixel

    print("Corrected PGW saved.")