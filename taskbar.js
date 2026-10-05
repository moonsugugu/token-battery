// Position a compact overlay beside the Windows notification area (DIP coordinates).
function taskbarBounds(display, width, height, layout = null) {
  const b = display.bounds, w = display.workArea;
  const right = b.x + b.width, bottom = b.y + b.height;
  width = Math.min(width, b.width);
  height = Math.min(height, b.height);
  const bar = layout?.bar;
  const onBottom = bar && bar.width > bar.height && bar.y >= b.y + b.height / 2
    && bar.y + bar.height <= bottom + 2 && bar.height >= height;
  const reserved = bottom - (w.y + w.height);
  const stripTop = onBottom ? bar.y : reserved >= height ? w.y + w.height : null;
  const stripHeight = onBottom ? bar.height : reserved;
  const edge = onBottom && layout.notify?.width > 0 ? layout.notify.x : right - 250;
  return {
    x: Math.round(Math.max(b.x, Math.min(right - width, edge - width - 6))),
    y: Math.round(stripTop == null ? w.y + w.height - height - 6 : stripTop + (stripHeight - height) / 2),
    width: Math.round(width), height: Math.round(height),
  };
}
module.exports = { taskbarBounds };
