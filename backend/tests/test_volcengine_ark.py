import unittest

from app.adapters.volcengine_ark import _image_size


def _pixel_count(size: str) -> int:
    width, height = size.split("x", 1)
    return int(width) * int(height)


class ImageSizeTests(unittest.TestCase):
    def test_portrait_default_size_meets_seedream_minimum_pixels(self) -> None:
        size = _image_size(None, "9:16")

        self.assertGreaterEqual(_pixel_count(size), 3_686_400)


if __name__ == "__main__":
    unittest.main()
