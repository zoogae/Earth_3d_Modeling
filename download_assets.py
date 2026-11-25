
from pathlib import Path
from urllib.request import Request, urlopen

# assets 폴더 생성
assets = Path(__file__).parent / "assets"
assets.mkdir(exist_ok=True)

# NASA 이미지 주소
urls = {
    "earth_day.png":
        "https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-2048.png",

    "earth_relief.jpg":
        "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/topography/gebco_08_rev_elev_5400x2700.jpg"
}

for name, url in urls.items():
    try:
        print("다운로드 중:", name)

        request = Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"}
        )

        with urlopen(request, timeout=35) as response:
            image_data = response.read()

        save_path = assets / name
        save_path.write_bytes(image_data)

        print("다운로드 완료:", save_path)

    except Exception as error:
        print("다운로드 실패:", name)
        print(error)

print("이미지 다운로드 작업 종료")
