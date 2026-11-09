"""Bake the public login map. Requires numpy, Pillow and pyshp."""

import tempfile
from pathlib import Path
from urllib.request import urlretrieve
from zipfile import ZipFile

import numpy as np
import shapefile
from PIL import Image, ImageDraw

DEM = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox=-111,30,-81,50&bboxSR=4326&imageSR=4326&size=900,720&format=tiff&pixelType=F32&f=image"
STATES = "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_20m.zip"
LAKES = "https://naturalearth.s3.amazonaws.com/50m_physical/ne_50m_lakes.zip"
OUTPUT = Path(__file__).resolve().parents[1] / "apps/web/public/login-map"


def download(name, url):
    file = Path(tempfile.gettempdir()) / name
    if not file.exists():
        urlretrieve(url, file)
    return file


def shapes(file):
    with ZipFile(file) as archive:
        shp = next(name for name in archive.namelist() if name.endswith(".shp"))
        with shapefile.Reader(shp=archive.open(shp)) as reader:
            return reader.shapes()


def bake():
    dem = Image.open(download("dte-dem.tif", DEM))
    width, height = dem.size
    dx, dy, _ = dem.tag_v2[33550]
    _, _, _, west, north, _ = dem.tag_v2[33922]
    assert np.allclose([west, north, dx * width, dy * height], [-111, 52, 30, 24])
    values = np.array(dem).clip(0, 4500)
    gy, gx = np.gradient(values)
    slope = np.tanh((gx - gy) / 105)
    contour = np.clip(1 - np.abs((values / 140 + 0.5) % 1 - 0.5) * 11, 0, 1)
    contour *= np.clip(np.hypot(gx, gy) / 45, 0, 1)
    high = np.clip((values - 470) / 3000, 0, 1) ** 0.8
    rgb = np.array([24., 53., 43.]) + high[..., None] * [102, 74, 36]
    rgb += slope[..., None] * [35, 31, 20] + contour[..., None] * [20, 26, 18]
    texture = Image.fromarray(rgb.clip(0, 255).astype("uint8"))

    def project(points):
        return [((x - west) / dx, (north - y) / dy) for x, y in points]

    def rings(shape):
        ends = [*shape.parts, len(shape.points)]
        return (project(shape.points[a:b]) for a, b in zip(ends, ends[1:]))

    draw = ImageDraw.Draw(texture, "RGBA")
    for lake in shapes(download("dte-lakes.zip", LAKES)):
        if lake.bbox[2] < west or lake.bbox[0] > west + dx * width or lake.bbox[3] < north - dy * height:
            continue
        for ring in rings(lake):
            draw.polygon(ring, fill=(42, 109, 112), outline=(122, 166, 148, 180))
    for state in shapes(download("dte-states.zip", STATES)):
        for ring in rings(state):
            draw.line(ring, fill=(180, 195, 151, 112), width=1)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    texture.save(OUTPUT / "terrain.webp", quality=89)
    grid = Image.fromarray(values).resize((128, 128), Image.Resampling.BILINEAR)
    np.rint(np.array(grid)).astype("<u2").tofile(OUTPUT / "elevation.bin")


if __name__ == "__main__":
    bake()
