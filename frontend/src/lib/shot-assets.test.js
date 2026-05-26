import test from "node:test";
import assert from "node:assert/strict";

import {
  getImageReferenceAssetIds,
  getVideoReferenceAssetIds,
  hasVideoSourceAsset
} from "./shot-assets.js";

test("image references merge all structured shot asset slots", () => {
  const shot = {
    character_asset_ids: ["char-1", "shared-1"],
    costume_asset_ids: ["costume-1", "shared-1"],
    scene_asset_ids: ["scene-1"],
    reference_asset_ids: ["ref-1", "scene-1"]
  };

  assert.deepEqual(getImageReferenceAssetIds(shot), [
    "char-1",
    "shared-1",
    "costume-1",
    "scene-1",
    "ref-1"
  ]);
});

test("video references only use the selected image asset", () => {
  const shot = {
    selected_image_asset_id: "selected-image",
    character_asset_ids: ["char-1"],
    reference_asset_ids: ["ref-1"]
  };

  assert.deepEqual(getVideoReferenceAssetIds(shot), ["selected-image"]);
});

test("video source asset requires a selected image", () => {
  assert.equal(hasVideoSourceAsset({ selected_image_asset_id: "image-1" }), true);
  assert.equal(hasVideoSourceAsset({ reference_asset_ids: ["ref-1"] }), false);
});
