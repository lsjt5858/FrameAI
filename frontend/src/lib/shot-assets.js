export function uniqueIds(ids) {
  return [...new Set((ids || []).filter(Boolean))];
}

export function getImageReferenceAssetIds(shot) {
  if (!shot) return [];
  return uniqueIds([
    ...(shot.character_asset_ids || []),
    ...(shot.costume_asset_ids || []),
    ...(shot.scene_asset_ids || []),
    ...(shot.reference_asset_ids || [])
  ]);
}

export function getVideoReferenceAssetIds(shot) {
  if (!shot?.selected_image_asset_id) return [];
  return [shot.selected_image_asset_id];
}

export function hasVideoSourceAsset(shot) {
  return getVideoReferenceAssetIds(shot).length > 0;
}
