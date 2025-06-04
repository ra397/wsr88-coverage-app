# from qrtDEM import readDEM, rotateDEM
from common import *
import numpy.typing as npt
import numpy as np
from math import floor


def quarter(k: str, w: int, h: int) -> (int, int):
    def west():return -w + 1

    def east(): return 0

    def north(): return 0

    def south(): return -h+1
    if   k == 'sw':
       return south(), west()
    elif k == 'se':
       return south(), east()
    elif k == 'nw':
       return north(), west()
    else: # ne
       return north(), east()

def quarterRotate(pref: str, data: npt.NDArray):
    if pref == 'ne':
        return data
    elif pref == 'se':
        return np.flip(data, axis=0)
    elif pref == 'nw':
        return np.flip(data, axis=1)
    elif pref == 'sw':
        return np.flip(data) # np.flip(np.flip(data, axis=0), axis=1)
# const.DEM path to DEM

def readDEM(path, easting: float, northing: float, quarter_pref: str ='ne', width:int = 306, height:int = 306) -> (npt.NDArray[np.float32], int, int, [any]):
    dataset = gdal.Open(path)
    geotransform = dataset.GetGeoTransform()
    left, top, x_cell, y_cell = geotransform[0], geotransform[3], geotransform[1], geotransform[5]
    ix, iy = floor((easting - left) / x_cell), floor((northing - top) / y_cell)
    qr = quarter(quarter_pref, width, height)
    ix += qr[1]
    iy += qr[0]
    band = dataset.GetRasterBand(1)
    ret = band.ReadAsArray(ix, iy, width, height)
    return ret, ix, iy, geotransform

class beamTracker1D:
    def __init__(self, path_beammodel=None) -> None:
        self.clearAll()
        if not path_beammodel is None:
            self.loadModel(path_beammodel)

    def loadModel(self, path_beammodel:str=None) -> None:
        src = np.load(path_beammodel, allow_pickle=True)
        self.rows, self.cols = src['height'][0].shape
        self.model['antenna_elevations'] = src['antenna']
        self.model['order_1d'] = src['order1D_azdst']
        self.model['invert_1d'] = src['invert1D_azdst']
        self.model['azimuths_1d'] = src['azimuths_1D_ord']  # azims_1d = radar_model['azimuths_1D_ord']
        self.model['beam_heights_1d'] = src['height_1D_ord']
        self.model['unq_az'] = src['unique_azims']
        self.model['unq_rng'] = src['azims_1D_range']
        del src
        self.raster_ix_1d = np.arange(0, self.model['order_1d'].shape[0], 1, dtype=np.int32)
        self.blocked_1d = np.zeros(self.raster_ix_1d.shape, dtype=np.int8)
        self.showResolution()

    def clearAll(self) -> None:
        self.model = {
            'antenna_elevations': None,
            'order_1d':           None,
            'invert_1d':          None,
            'azimuths_1d':        None,
            'beam_heights_1d':    None,
            'unq_az':             None,
            'unq_rng':            None,
        }
        self.dem_src = None
        self.easting = None
        self.northing = None
        self.tower_elevation = None
        self.max_altitude = ft2m(3000)
        self.cols = None
        self.rows = None
        self.quarter_pref = None
        self.raster_ix_1d = None
        self.blocked_1d = None
        self.dem_1d = None

    def clearResults(self)->None:
        self.blocked_1d = np.zeros(self.raster_ix_1d.shape, dtype=np.uint8)

    def emptyDEM(self)->None:
        self.dem_1d = None

    def setRadar(self, easting:float, northing:float, tower_elevation:float) -> None:
        self.easting, self.northing, self.tower_elevation = easting, northing, tower_elevation



    def readDEM(self, easting:float=None, northing:float=None, tower_elevation:float=None, quarter_pref:str=None) -> None:
        if (    not easting is None
            and not northing is None
            and not tower_elevation is None
        ):
            self.setRadar(easting=None, northing=None, tower_elevation=None)

        if not quarter_pref is None:
            self.quarter_pref = quarter_pref

        self.emptyDEM()
        data, ix, iy, gt  = readDEM(path=self.dem_src, easting=self.easting, northing=self.northing, quarter_pref=self.quarter_pref, width=self.cols, height=self.rows)
        print (f'QRT DEM.shape: {data.shape}')
        print (ix, iy, gt)
        self.dem_1d =  quarterRotate(
            self.quarter_pref,
            data
        ).ravel()[self.model['order_1d']].astype(np.float32)

    def setQuarter(self, quarter_pref: str) -> None:
        self.quarter_pref = quarter_pref

    def showResolution(self) -> None:
        angular = round(90 / (self.model['unq_az'].shape[0] - 2), 2)
        liniar = round(230e3 / self.cols, 0)
        print(f'ncols x nrows: {self.cols} x {self.cols}\nangular step: {angular}, liniar: {liniar}')

    def calcBlockage(self, antenna_elevation: float, max_altitude: float=None) -> None:
        if not max_altitude is None:
            self.max_altitude = max_altitude
        _blocked = np.zeros(self.raster_ix_1d.shape, dtype=bool)
        _el = np.where(self.model['antenna_elevations'] == antenna_elevation)[0][0]
        _beam = self.tower_elevation + self.model['beam_heights_1d'][_el]
        inter = _beam < self.dem_1d
        if np.nansum(inter) > 0:
            unq_az_inter, unq_ix_inter = np.unique(self.model['azimuths_1d'][inter], return_index=1)
            firts_ix = self.raster_ix_1d[inter][unq_ix_inter]
            last_ix = self.model['unq_rng'][np.searchsorted(self.model['unq_az'], unq_az_inter)][:, 1]
            _blocked[
                np.r_[
                    tuple(slice(start, end) for start, end in zip(firts_ix, last_ix))
                ]
            ] = True
            # if np.nansum(unq_az_inter):
            #     for i in range(0, len(unq_az_inter)):
            #         u = np.int32(unq_az_inter[i])
            #         r_ix = np.where( self.model['unq_az'] == u)[0][0]
            #         b, e = firts_ix[i], self.model['unq_rng'][r_ix][1]
            #         _blocked[b:e] = 1
        _blocked[_beam > self.dem_1d + self.max_altitude] = True
        _blocked[0] = True
        self.blocked_1d += np.invert(_blocked).astype(np.uint8)

    def getBlockage(self) -> npt.NDArray[np.uint8]:
        return self.blocked_1d[self.model['invert_1d']].reshape(self.cols, self.rows)


