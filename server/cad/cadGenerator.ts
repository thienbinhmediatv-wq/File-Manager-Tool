import * as fs from "fs";
import * as path from "path";
import type { GeometryResult, GeometryFloor, PositionedRoom } from "../geometry/geometryEngine.js";

const SCALE = 60;
const MARGIN = 140;
const DIM_OFFSET = 30;
const DIM_LAYER_SPACING = 28;
const TITLE_BLOCK_W = 160;
const FONT = "Arial, sans-serif";

function m2px(meters: number): number {
  return meters * SCALE;
}


function fmtM(n: number): string {
  return `${n.toFixed(2)}m`;
}

interface SvgEl {
  tag: string;
  attrs: Record<string, string | number>;
  children?: SvgEl[];
  text?: string;
}

function el(tag: string, attrs: Record<string, string | number>, children?: SvgEl[], text?: string): SvgEl {
  return { tag, attrs, children, text };
}

function renderEl(e: SvgEl, indent = 0): string {
  const pad = "  ".repeat(indent);
  const attrStr = Object.entries(e.attrs).map(([k, v]) => `${k}="${v}"`).join(" ");
  if (e.text !== undefined) {
    return `${pad}<${e.tag} ${attrStr}>${e.text}</${e.tag}>`;
  }
  if (!e.children || e.children.length === 0) {
    return `${pad}<${e.tag} ${attrStr}/>`;
  }
  const childStr = e.children.map(c => renderEl(c, indent + 1)).join("\n");
  return `${pad}<${e.tag} ${attrStr}>\n${childStr}\n${pad}</${e.tag}>`;
}

function roomColor(fn: string): string {
  const colors: Record<string, string> = {
    living: "#FFF9F0",
    kitchen: "#F0FFF4",
    dining: "#F0FFF4",
    bedroom: "#F0F4FF",
    wc: "#F5F0FF",
    garage: "#F5F5F5",
    stair: "#FFFDE7",
    corridor: "#FAFAFA",
    balcony: "#F0FFFF",
    other: "#FAFAFA",
  };
  return colors[fn] || "#FAFAFA";
}


function drawDimHBelow(x1: number, x2: number, baseY: number, label: string, layerIndex: number): SvgEl[] {
  const yo = baseY + DIM_OFFSET + layerIndex * DIM_LAYER_SPACING;
  return [
    el("line", { x1, y1: baseY, x2: x1, y2: yo, stroke: "#0066CC", "stroke-width": "0.5", "stroke-dasharray": "2 2" }),
    el("line", { x1: x2, y1: baseY, x2: x2, y2: yo, stroke: "#0066CC", "stroke-width": "0.5", "stroke-dasharray": "2 2" }),
    el("line", { x1, y1: yo, x2: x2, y2: yo, stroke: "#0066CC", "stroke-width": "0.8",
      "marker-start": "url(#arrowDim)", "marker-end": "url(#arrowDim)" }),
    el("text", {
      x: (x1 + x2) / 2, y: yo - 4,
      "text-anchor": "middle", "font-family": FONT,
      "font-size": "8", fill: "#0066CC",
    }, undefined, label),
  ];
}

function drawDimVLeft(y1: number, y2: number, baseX: number, label: string, layerIndex: number): SvgEl[] {
  const xo = baseX - DIM_OFFSET - layerIndex * DIM_LAYER_SPACING;
  return [
    el("line", { x1: baseX, y1, x2: xo, y2: y1, stroke: "#0066CC", "stroke-width": "0.5", "stroke-dasharray": "2 2" }),
    el("line", { x1: baseX, y1: y2, x2: xo, y2: y2, stroke: "#0066CC", "stroke-width": "0.5", "stroke-dasharray": "2 2" }),
    el("line", { x1: xo, y1, x2: xo, y2: y2, stroke: "#0066CC", "stroke-width": "0.8",
      "marker-start": "url(#arrowDim)", "marker-end": "url(#arrowDim)" }),
    el("text", {
      x: xo - 6, y: (y1 + y2) / 2,
      "text-anchor": "middle", "font-family": FONT,
      "font-size": "8", fill: "#0066CC",
      transform: `rotate(-90, ${xo - 6}, ${(y1 + y2) / 2})`,
    }, undefined, label),
  ];
}


function drawTitleBlock(
  svgH: number,
  floorLabel: string,
  landWidth: number,
  landLength: number,
  totalArea: number,
  rightX: number
): SvgEl[] {
  const x = rightX + 10;
  const w = TITLE_BLOCK_W;
  const pad = 8;
  const rows: Array<{ label: string; value: string }> = [
    { label: "ĐƠN VỊ", value: "BMT DECOR" },
    { label: "GIÁM ĐỐC", value: "Võ Quốc Bảo" },
    { label: "TỈ LỆ", value: "1/100" },
    { label: "KHU ĐẤT", value: `${landWidth}×${landLength}m` },
    { label: "DIỆN TÍCH", value: `${totalArea.toFixed(1)} m²` },
  ];

  const titleBlockEls: SvgEl[] = [
    el("rect", { x, y: 20, width: w, height: svgH - 40, fill: "white", stroke: "#333", "stroke-width": "1" }),
    el("rect", { x, y: 20, width: w, height: 40, fill: "#1A237E" }),
    el("text", { x: x + w / 2, y: 45, "text-anchor": "middle", "font-family": FONT, "font-size": "12", fill: "white", "font-weight": "bold" }, undefined, "BMT DECOR"),
    el("text", { x: x + w / 2, y: 58, "text-anchor": "middle", "font-family": FONT, "font-size": "7", fill: "#90CAF9" }, undefined, "thicongtramsac.vn"),
    el("text", { x: x + w / 2, y: 82, "text-anchor": "middle", "font-family": FONT, "font-size": "10", fill: "#1A237E", "font-weight": "bold" }, undefined, floorLabel),
    el("line", { x1: x, y1: 92, x2: x + w, y2: 92, stroke: "#CCC", "stroke-width": "0.5" }),
  ];

  let rowY = 105;
  for (const row of rows) {
    titleBlockEls.push(
      el("text", { x: x + pad, y: rowY, "font-family": FONT, "font-size": "7.5", fill: "#777" }, undefined, row.label),
      el("text", { x: x + pad, y: rowY + 12, "font-family": FONT, "font-size": "9", fill: "#222", "font-weight": "bold" }, undefined, row.value),
      el("line", { x1: x, y1: rowY + 18, x2: x + w, y2: rowY + 18, stroke: "#EEE", "stroke-width": "0.5" }),
    );
    rowY += 28;
  }

  titleBlockEls.push(
    el("text", { x: x + w / 2, y: svgH - 30, "text-anchor": "middle", "font-family": FONT, "font-size": "7", fill: "#999" }, undefined, "7/92 Thành Thái, Q.10, TP.HCM"),
    el("text", { x: x + w / 2, y: svgH - 18, "text-anchor": "middle", "font-family": FONT, "font-size": "7", fill: "#BBB" }, undefined, `Bản vẽ: KT-0${floorLabel.slice(-1) || "1"}`),
  );

  return titleBlockEls;
}

function groupRoomsByRow(rooms: PositionedRoom[]): Map<number, PositionedRoom[]> {
  const rowMap = new Map<number, PositionedRoom[]>();
  for (const room of rooms) {
    const rowKey = Math.round(room.y * 100) / 100;
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
    rowMap.get(rowKey)!.push(room);
  }
  for (const [, rowRooms] of rowMap) {
    rowRooms.sort((a, b) => a.x - b.x);
  }
  return rowMap;
}

function generateFloorSVG(floor: GeometryFloor, geometry: GeometryResult): string {
  const { landWidth, landLength, setback } = geometry;
  const planW = m2px(landWidth);
  const planH = m2px(landLength);

  const rowMap = groupRoomsByRow(floor.rooms);
  const sortedRowKeys = Array.from(rowMap.keys()).sort((a, b) => a - b);
  const hDimLayers = sortedRowKeys.length + 1;
  const vDimLayers = sortedRowKeys.length + 1;

  const bottomDimSpace = DIM_OFFSET + hDimLayers * DIM_LAYER_SPACING + 30;
  const leftDimSpace = DIM_OFFSET + vDimLayers * DIM_LAYER_SPACING + 30;

  const effectiveMarginBottom = Math.max(MARGIN, bottomDimSpace);
  const effectiveMarginLeft = Math.max(MARGIN, leftDimSpace);

  const svgW = effectiveMarginLeft + planW + MARGIN + TITLE_BLOCK_W + 20;
  const svgH = effectiveMarginLeft + planH + effectiveMarginBottom;
  const floorLabel = floor.floor === 1 ? "TẦNG TRỆT" : `LẦU ${floor.floor - 1}`;

  const pxL = (meters: number, offset = 0) => effectiveMarginLeft + m2px(meters) + offset;

  const defs = `<defs>
    <marker id="arrowDim" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#0066CC"/>
    </marker>
  </defs>`;

  const elements: SvgEl[] = [];

  const drawGridLocal = (lw: number, ll: number): SvgEl[] => {
    const els: SvgEl[] = [];
    const colCount = Math.ceil(lw);
    const rowCount = Math.ceil(ll);
    for (let i = 0; i <= colCount; i++) {
      const gx = pxL(i);
      els.push(
        el("line", { x1: gx, y1: pxL(0) - 20, x2: gx, y2: pxL(ll) + 20, stroke: "#CCC", "stroke-width": "0.5", "stroke-dasharray": "4 6" }),
        el("circle", { cx: gx, cy: pxL(0) - 20, r: 10, fill: "white", stroke: "#888", "stroke-width": "0.8" }),
        el("text", { x: gx, y: pxL(0) - 16, "text-anchor": "middle", "font-family": FONT, "font-size": "9", fill: "#555" }, undefined, String(i + 1))
      );
    }
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let j = 0; j <= rowCount; j++) {
      const gy = pxL(j);
      els.push(
        el("line", { x1: pxL(0) - 20, y1: gy, x2: pxL(lw) + 20, y2: gy, stroke: "#CCC", "stroke-width": "0.5", "stroke-dasharray": "4 6" }),
        el("circle", { cx: pxL(0) - 20, cy: gy, r: 10, fill: "white", stroke: "#888", "stroke-width": "0.8" }),
        el("text", { x: pxL(0) - 20, y: gy + 4, "text-anchor": "middle", "font-family": FONT, "font-size": "9", fill: "#555" }, undefined, letters[j] || String(j))
      );
    }
    return els;
  };

  elements.push(...drawGridLocal(landWidth, landLength));

  elements.push(
    el("line", {
      x1: pxL(0), y1: pxL(setback), x2: pxL(landWidth), y2: pxL(setback),
      stroke: "#F44336", "stroke-width": "1", "stroke-dasharray": "8 4",
    }),
    el("text", {
      x: pxL(landWidth) + 5, y: pxL(setback) + 4,
      "font-family": FONT, "font-size": "7.5", fill: "#F44336",
    }, undefined, `KL ${setback}m`)
  );

  for (const room of floor.rooms) {
    const x = pxL(room.x);
    const y = pxL(room.y);
    const w = m2px(room.width);
    const h = m2px(room.height);
    const fill = roomColor(room.function);
    elements.push(
      el("rect", { x, y, width: w, height: h, fill, stroke: "#222", "stroke-width": "1.5" }),
      el("text", { x: x + w / 2, y: y + h / 2 - 8, "text-anchor": "middle", "font-family": FONT, "font-size": "9", fill: "#333", "font-weight": "bold" }, undefined, room.name),
      el("text", { x: x + w / 2, y: y + h / 2 + 8, "text-anchor": "middle", "font-family": FONT, "font-size": "8", fill: "#555" }, undefined, `${room.width.toFixed(1)}×${room.height.toFixed(1)}m`),
      el("text", { x: x + w / 2, y: y + h / 2 + 20, "text-anchor": "middle", "font-family": FONT, "font-size": "7.5", fill: "#777" }, undefined, `S=${room.area.toFixed(1)}m²`)
    );
  }

  for (const wall of floor.walls) {
    const isExt = wall.type === "exterior";
    elements.push(el("line", {
      x1: pxL(wall.x1), y1: pxL(wall.y1),
      x2: pxL(wall.x2), y2: pxL(wall.y2),
      stroke: isExt ? "#111" : "#444",
      "stroke-width": isExt ? 3 : 1.5,
      "stroke-linecap": "square",
    }));
  }

  for (const door of floor.doors) {
    const x = pxL(door.x);
    const y = pxL(door.y);
    const dw = m2px(door.width);
    elements.push(
      el("line", { x1: x, y1: y, x2: x + dw, y2: y, stroke: "#fff", "stroke-width": "4" }),
      el("line", { x1: x, y1: y, x2: x + dw, y2: y, stroke: "#E91E63", "stroke-width": "2", "stroke-dasharray": "none" })
    );
    if (door.swing === "right") {
      elements.push(el("path", { d: `M ${x} ${y} A ${dw} ${dw} 0 0 1 ${x + dw} ${y + dw}`, fill: "none", stroke: "#E91E63", "stroke-width": "1", "stroke-dasharray": "4 2" }));
    } else {
      elements.push(el("path", { d: `M ${x + dw} ${y} A ${dw} ${dw} 0 0 0 ${x} ${y + dw}`, fill: "none", stroke: "#E91E63", "stroke-width": "1", "stroke-dasharray": "4 2" }));
    }
  }

  for (const win of floor.windows) {
    const x = pxL(win.x);
    const ww = m2px(win.width);
    const isNorth = win.y === 0;
    const wy = isNorth ? pxL(0) : pxL(win.y);
    elements.push(
      el("line", { x1: x, y1: wy - 3, x2: x + ww, y2: wy - 3, stroke: "#1976D2", "stroke-width": "3" }),
      el("line", { x1: x, y1: wy + 3, x2: x + ww, y2: wy + 3, stroke: "#1976D2", "stroke-width": "3" })
    );
  }

  const bottomBaseY = pxL(landLength);
  const leftBaseX = pxL(0);

  let hLayer = 0;
  for (const rowKey of sortedRowKeys) {
    const rowRooms = rowMap.get(rowKey)!;
    const segments: Array<{ start: number; end: number }> = [];
    for (const room of rowRooms) {
      segments.push({ start: room.x, end: room.x + room.width });
    }
    segments.sort((a, b) => a.start - b.start);

    let cursor = 0;
    for (const seg of segments) {
      if (seg.start > cursor + 0.01) {
        elements.push(...drawDimHBelow(pxL(cursor), pxL(seg.start), bottomBaseY, fmtM(+(seg.start - cursor).toFixed(2)), hLayer));
      }
      elements.push(...drawDimHBelow(pxL(seg.start), pxL(seg.end), bottomBaseY, fmtM(+(seg.end - seg.start).toFixed(2)), hLayer));
      cursor = seg.end;
    }
    if (cursor < landWidth - 0.01) {
      elements.push(...drawDimHBelow(pxL(cursor), pxL(landWidth), bottomBaseY, fmtM(+(landWidth - cursor).toFixed(2)), hLayer));
    }
    hLayer++;
  }
  elements.push(...drawDimHBelow(pxL(0), pxL(landWidth), bottomBaseY, `${fmtM(landWidth)} (Tổng)`, hLayer));

  interface RowExtent { top: number; bottom: number; }
  const rowExtents: RowExtent[] = [];
  let vLayer = 0;
  for (const rowKey of sortedRowKeys) {
    const rowRooms = rowMap.get(rowKey)!;
    const rowTop = Math.min(...rowRooms.map(r => r.y));
    const rowBottom = Math.max(...rowRooms.map(r => r.y + r.height));
    const rowHeight = +(rowBottom - rowTop).toFixed(2);
    rowExtents.push({ top: rowTop, bottom: rowBottom });
    elements.push(...drawDimVLeft(pxL(rowTop), pxL(rowBottom), leftBaseX, fmtM(rowHeight), vLayer));
    vLayer++;
  }

  if (rowExtents.length > 0) {
    const firstTop = rowExtents[0].top;
    if (firstTop > 0.01) {
      elements.push(...drawDimVLeft(pxL(0), pxL(firstTop), leftBaseX, fmtM(+firstTop.toFixed(2)), vLayer - 1));
    }
    const lastBottom = rowExtents[rowExtents.length - 1].bottom;
    if (lastBottom < landLength - 0.01) {
      elements.push(...drawDimVLeft(pxL(lastBottom), pxL(landLength), leftBaseX, fmtM(+(landLength - lastBottom).toFixed(2)), vLayer - 1));
    }
    for (let i = 0; i < rowExtents.length - 1; i++) {
      const gapTop = rowExtents[i].bottom;
      const gapBottom = rowExtents[i + 1].top;
      if (gapBottom - gapTop > 0.01) {
        elements.push(...drawDimVLeft(pxL(gapTop), pxL(gapBottom), leftBaseX, fmtM(+(gapBottom - gapTop).toFixed(2)), vLayer - 1));
      }
    }
  }
  elements.push(...drawDimVLeft(pxL(0), pxL(landLength), leftBaseX, `${fmtM(landLength)} (Tổng)`, vLayer));

  elements.push(...drawTitleBlock(svgH, floorLabel, landWidth, landLength, floor.totalArea, effectiveMarginLeft + planW));

  elements.push(
    el("text", {
      x: effectiveMarginLeft + planW / 2, y: svgH - 10,
      "text-anchor": "middle", "font-family": FONT, "font-size": "9", fill: "#555",
    }, undefined, `MẶT BẰNG ${floorLabel}  –  TỈ LỆ 1:100  –  BMT DECOR`),
    el("rect", {
      x: effectiveMarginLeft, y: effectiveMarginLeft, width: planW, height: planH,
      fill: "none", stroke: "#111", "stroke-width": "2",
    })
  );

  const bodyStr = elements.map(e => renderEl(e, 1)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  ${defs}
  <rect width="${svgW}" height="${svgH}" fill="white"/>
  <!-- Floor plan: ${floorLabel} | ${landWidth}m x ${landLength}m | BMT Decor -->
${bodyStr}
</svg>`;
}

export interface CADFloorplan {
  floor: number;
  floorLabel: string;
  svgContent: string;
  svgUrl: string;
}

export function generateCADSVG(
  geometry: GeometryResult,
  projectId: number
): CADFloorplan[] {
  const outputDir = path.join(process.cwd(), "public", "generated");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const floorplans: CADFloorplan[] = [];

  for (const floor of geometry.floors) {
    const floorLabel = floor.floor === 1 ? "TẦNG TRỆT" : `LẦU ${floor.floor - 1}`;
    const svg = generateFloorSVG(floor, geometry);
    const filename = `cad_svg_${projectId}_floor${floor.floor}_${Date.now()}.svg`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, svg, "utf8");

    floorplans.push({
      floor: floor.floor,
      floorLabel,
      svgContent: svg,
      svgUrl: `/generated/${filename}`,
    });
  }

  return floorplans;
}
