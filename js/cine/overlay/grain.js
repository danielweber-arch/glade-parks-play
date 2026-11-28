// One small code-made noise tile. Made once, shown on a plain alpha layer.
export function makeGrainTile(size = 128, seed = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  let s = seed >>> 0;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const v = s >>> 24;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
