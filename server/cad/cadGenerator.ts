import * as fs from "fs";
import * as path from "path";
import type { GeometryResult, GeometryFloor, PositionedRoom, Wall, Door, Window } from "../geometry/geometryEngine.js";

const SCALE = 60;
const MARGIN = 80;
const DIM_OFFSET = 30;
const TITLE_BLOCK_W = 160;
const FONT = "Arial, sans-serif";

function m2px(meters: number): number {
  return meters * SCALE;
}

function px(meters: number, offset = 0): number {
  return MARGIN + m2px(meters) + offset;
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

function drawRoom(room: PositionedRoom): SvgEl[] {
  const x = px(room.x);
  const y = px(room.y);
  const w = m2px(room.width);
  const h = m2px(room.height);
  const fill = roomColor(room.function);

  return [
    el("rect", { x, y, width: w, height: h, fill, stroke: "#222", "stroke-width": "1.5" }),
    el("text", {
      x: x + w / 2, y: y + h / 2 - 8,
      "text-anchor": "middle", "font-family": FONT,
      "font-size": "9", fill: "#333", "font-weight": "bold",
    }, undefined, room.name),
    el("text", {
      x: x + w / 2, y: y + h / 2 + 8,
      "text-anchor": "middle", "font-family": FONT,
      "font-size": "8", fill: "#555",
    }, undefined, `${room.width.toFixed(1)}×${room.height.toFixed(1)}m`),
    el("text", {
      x: x + w / 2, y: y + h / 2 + 20,
      "text-anchor": "middle", "font-family": FONT,
      "font-size": "7.5", fill: "#777",
    }, undefined, `S=${room.area.toFixed(1)}m²`),
  ];
}

function drawWall(wall: Wall): SvgEl {
  const isExt = wall.type === "exterior";
  return el("line", {
    x1: px(wall.x1), y1: px(wall.y1),
    x2: px(wall.x2), y2: px(wall.y2),
    stroke: isExt ? "#111" : "#444",
    "stroke-width": isExt ? 3 : 1.5,
    "stroke-linecap": "square",
  });
}

function drawDoor(door: Door): SvgEl[] {
  const x = px(door.x);
  const y = px(door.y);
  const dw = m2px(door.width);
  const isHoriz = true;

  const elements: SvgEl[] = [
    el("line", {
      x1: x, y1: y, x2: x + dw, y2: y,
      stroke: "#fff", "stroke-width": "4",
    }),
    el("line", {
      x1: x, y1: y, x2: x + dw, y2: y,
      stroke: "#E91E63", "stroke-width": "2", "stroke-dasharray": "none",
    }),
  ];

  if (door.swing === "right") {
    elements.push(el("path", {
      d: `M ${x} ${y} A ${dw} ${dw} 0 0 1 ${x + dw} ${y + dw}`,
      fill: "none", stroke: "#E91E63", "stroke-width": "1",
      "stroke-dasharray": "4 2",
    }));
  } else {
    elements.push(el("path", {
      d: `M ${x + dw} ${y} A ${dw} ${dw} 0 0 0 ${x} ${y + dw}`,
      fill: "none", stroke: "#E91E63", "stroke-width": "1",
      "stroke-dasharray": "4 2",
    }));
  }

  return elements;
}

function drawWindow(win: Window, landWidth: number): SvgEl[] {
  const x = px(win.x);
  const ww = m2px(win.width);
  const isNorth = win.y === 0;
  const wy = isNorth ? px(0) : px(win.y);

  return [
    el("line", {
      x1: x, y1: wy - 3, x2: x + ww, y2: wy - 3,
      stroke: "#1976D2", "stroke-width": "3",
    }),
    el("line", {
      x1: x, y1: wy + 3, x2: x + ww, y2: wy + 3,
      stroke: "#1976D2", "stroke-width": "3",
    }),
  ];
}

function drawDimensionH(x1: number, x2: number, y: number, label: string, offset = 0): SvgEl[] {
  const yo = y - DIM_OFFSET - offset;
  return [
    el("line", { x1, y1: y, x2: x1, y2: yo, stroke: "#0066CC", "stroke-width": "0.8" }),
    el("line", { x1: x2, y1: y, x2: x2, y2: yo, stroke: "#0066CC", "stroke-width": "0.8" }),
    el("line", { x1, y1: yo, x2: x2, y2: yo, stroke: "#0066CC", "stroke-width": "0.8",
      "marker-start": "url(#arrowDim)", "marker-end": "url(#arrowDim)" }),
    el("text", {
      x: (x1 + x2) / 2, y: yo - 5,
      "text-anchor": "middle", "font-family": FONT,
      "font-size": "8", fill: "#0066CC",
    }, undefined, label),
  ];
}

function drawDimensionV(x: number, y1: number, y2: number, label: string, offset = 0): SvgEl[] {
  const xo = x - DIM_OFFSET - offset;
  return [
    el("line", { x1: x, y1, x2: xo, y2: y1, stroke: "#0066CC", "stroke-width": "0.8" }),
    el("line", { x1: x, y1: y2, x2: xo, y2: y2, stroke: "#0066CC", "stroke-width": "0.8" }),
    el("line", { x1: xo, y1: y1, x2: xo, y2: y2, stroke: "#0066CC", "stroke-width": "0.8",
      "marker-start": "url(#arrowDim)", "marker-end": "url(#arrowDim)" }),
    el("text", {
      x: xo - 8, y: (y1 + y2) / 2,
      "text-anchor": "middle", "font-family": FONT,
      "font-size": "8", fill: "#0066CC",
      transform: `rotate(-90, ${xo - 8}, ${(y1 + y2) / 2})`,
    }, undefined, label),
  ];
}

function drawGrid(landWidth: number, landLength: number): SvgEl[] {
  const els: SvgEl[] = [];
  const colCount = Math.ceil(landWidth);
  const rowCount = Math.ceil(landLength);

  for (let i = 0; i <= colCount; i++) {
    const gx = px(i);
    els.push(
      el("line", {
        x1: gx, y1: px(0) - 20,
        x2: gx, y2: px(landLength) + 20,
        stroke: "#CCC", "stroke-width": "0.5", "stroke-dasharray": "4 6",
      }),
      el("circle", { cx: gx, cy: px(0) - 20, r: 10, fill: "white", stroke: "#888", "stroke-width": "0.8" }),
      el("text", { x: gx, y: px(0) - 16, "text-anchor": "middle", "font-family": FONT, "font-size": "9", fill: "#555" }, undefined, String(i + 1))
    );
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let j = 0; j <= rowCount; j++) {
    const gy = px(j);
    els.push(
      el("line", {
        x1: px(0) - 20, y1: gy,
        x2: px(landWidth) + 20, y2: gy,
        stroke: "#CCC", "stroke-width": "0.5", "stroke-dasharray": "4 6",
      }),
      el("circle", { cx: px(0) - 20, cy: gy, r: 10, fill: "white", stroke: "#888", "stroke-width": "0.8" }),
      el("text", { x: px(0) - 20, y: gy + 4, "text-anchor": "middle", "font-family": FONT, "font-size": "9", fill: "#555" }, undefined, letters[j] || String(j))
    );
  }

  return els;
}

function drawSetbackLine(setback: number, landWidth: number): SvgEl[] {
  const y = px(setback);
  return [
    el("line", {
      x1: px(0), y1: y, x2: px(landWidth), y2: y,
      stroke: "#F44336", "stroke-width": "1", "stroke-dasharray": "8 4",
    }),
    el("text", {
      x: px(landWidth) + 5, y: y + 4,
      "font-family": FONT, "font-size": "7.5", fill: "#F44336",
    }, undefined, `KL ${setback}m`),
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

function generateFloorSVG(floor: GeometryFloor, geometry: GeometryResult): string {
  const { landWidth, landLength, setback } = geometry;
  const planW = m2px(landWidth);
  const planH = m2px(landLength);
  const svgW = MARGIN + planW + MARGIN + TITLE_BLOCK_W + 20;
  const svgH = MARGIN + planH + MARGIN;
  const floorLabel = floor.floor === 1 ? "TẦNG TRỆT" : `LẦU ${floor.floor - 1}`;

  const defs = `<defs>
    <marker id="arrowDim" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#0066CC"/>
    </marker>
  </defs>`;

  const elements: SvgEl[] = [];

  elements.push(...drawGrid(landWidth, landLength));
  elements.push(...drawSetbackLine(setback, landWidth));

  for (const room of floor.rooms) {
    elements.push(...drawRoom(room));
  }

  for (const wall of floor.walls) {
    elements.push(drawWall(wall));
  }

  for (const door of floor.doors) {
    elements.push(...drawDoor(door));
  }

  for (const win of floor.windows) {
    elements.push(...drawWindow(win, landWidth));
  }

  elements.push(
    ...drawDimensionH(px(0), px(landWidth), px(0), `${fmtM(landWidth)} (Tổng chiều ngang)`, 0),
    ...drawDimensionV(px(0), px(0), px(landLength), `${fmtM(landLength)} (Tổng chiều dài)`, 0)
  );

  for (const room of floor.rooms) {
    elements.push(
      ...drawDimensionH(px(room.x), px(room.x + room.width), px(room.y), fmtM(room.width), 20)
    );
  }

  elements.push(...drawTitleBlock(svgH, floorLabel, landWidth, landLength, floor.totalArea, MARGIN + planW));

  elements.push(
    el("text", {
      x: MARGIN + planW / 2, y: svgH - 10,
      "text-anchor": "middle", "font-family": FONT, "font-size": "9", fill: "#555",
    }, undefined, `MẶT BẰNG ${floorLabel}  –  TỈ LỆ 1:100  –  BMT DECOR`),
    el("rect", {
      x: MARGIN, y: MARGIN, width: planW, height: planH,
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
