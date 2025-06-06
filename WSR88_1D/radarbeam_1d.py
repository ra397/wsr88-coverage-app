from math import cos, sin, radians, degrees
import numpy as np
import numpy.typing as npt
from common import *
from common import plotData



# https://journals.ametsoc.org/view/journals/mwre/147/3/mwr-d-18-0356.1.xml#e35
# https://journals.ametsoc.org/view/journals/wefo/18/3/1520-0434_2003_18_393_idunea_2_0_co_2.pdf

def getElev1_21(_angle: float, slant_dist: npt.NDArray[np.float32]) -> npt.NDArray[np.float32]:   # _range -> slant range, _angle -> elevation angle
    _sin = sin(_angle)
    _cos = cos(_angle)
    _cos2 = _cos**2
    slant_dist2 = np.power(slant_dist,2)
    return slant_dist * _sin +  slant_dist2 * _cos2/2/EARTH_RADIUS - kZ * slant_dist2 *  _cos /2

def getElev4_3(_angel: float, slant_dist: npt.NDArray[np.float32]) -> npt.NDArray[np.float32]:
    # h = sqrt(r ^ 2 + (a_e + h0) ^ 2 + 2 * r * (a_e + h0) * sin(θ)) - a_e
    EFF_RAD = 4./3.*EARTH_RADIUS
    return (
        np.power(slant_dist, 2) + EFF_RAD**2 + slant_dist * (2 * 4/3 * EARTH_RADIUS * sin(_angel))
    )**0.5 - EFF_RAD

def getDist(_angle:float, slant_range: npt.NDArray[np.float32]) -> npt.NDArray[np.float32]:            # range on the equivalent earth,
    ret =  slant_range*cos(_angle) /(slant_range * sin(_angle) + EFF_RADIUS)
    return EFF_RADIUS*np.arctan(ret) #,  EFF_RADIUS*atan(ret) - _range*cos(_angle)

def getSlant(_angle: float, _distance: npt.NDArray[np.float32]) -> npt.NDArray[np.float32]:
    tan_eE = np.tan(_distance/EARTH_RADIUS)
    return (EARTH_RADIUS * tan_eE)/(cos(_angle) - sin(_angle)*tan_eE)

max, step  = 230e3, 90
n = int(max/step)
deg_fraction = 0.1

if __name__ == '__main__':
    xs = np.tile(np.arange(0, n*step, step, dtype=np.float32), (n, 1))
    ys = np.tile(np.arange(0, n*step, step, dtype=np.float32).reshape(n, 1), (1, n))
    xs[xs==0] = 1/1e10 # -> to avoid /0 warning
    earth_dist = np.power(np.power(xs, 2) + np.power(ys, 2), 0.5)
    azims = np.round(
        np.degrees(
            np.arctan(ys/xs)
        )/deg_fraction,0
    ).astype(np.int16)
    sorter_azDst = np.lexsort((earth_dist.ravel(), azims.ravel())).astype(np.int32)
    ray_height = [None]*len(VCP12)
    for i, ae in enumerate(VCP12):
        # antenna = radians(ae)                       # for center of the beam
        antenna = radians(ae - (.9/2))              # -9/2 for bottom of the beam
        ray_dist = getSlant(antenna, earth_dist)        # what beam propagation model ?
        _ray_height = getElev1_21(antenna, ray_dist)

        _mask = earth_dist > max
        azims[_mask] = -999
        _ray_height[_mask] = 99e10
        ray_height[i] = _ray_height

    azims_1d = azims.ravel()[sorter_azDst]
    ua, ui, uc = np.unique(azims_1d, return_index=True, return_counts=True)
    ur = [(t[0], t[0] + t[1]) for t in zip(ui, uc)]

    np.savez(
        f'radar_beam_1_21',
        antenna =   VCP12,
        height = ray_height,
        distancies = earth_dist.astype(np.float32),
        azimuths = azims,

        azimuths_1D_ord = azims_1d,
        height_1D_ord =[r.ravel()[sorter_azDst] for r in ray_height],
        order1D_azdst = sorter_azDst.astype(np.int32),
        invert1D_azdst = np.argsort(sorter_azDst).astype(np.int32),
        unique_azims = ua,
        azims_1D_range = ur
    )

