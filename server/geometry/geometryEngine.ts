export interface RoomInput {
  name: string;
  w: number;
  h: number;
  x?: number;
  y?: number;
}

export interface FloorInput {
  floor: number;
  rooms: RoomInput[];
}

export interface PositionedRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  function: RoomFunction;
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  type: "exterior" | "interior";
}

export interface Door {
  id: string;
  wallId: string;
  x: number;
  y: number;
  width: number;
  swing: "left" | "right";
  type: "entrance" | "room" | "service";
}

export interface Window {
  id: string;
  wallId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeometryFloor {
  floor: number;
  rooms: PositionedRoom[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  totalArea: number;
  buildableArea: { x: number; y: number; width: number; height: number };
}

export interface GeometryResult {
  floors: GeometryFloor[];
  landWidth: number;
  landLength: number;
  setback: number;
  validation: {
    isValid: boolean;
    warnings: string[];
    totalFloorArea: number;
    coverageRatio: number;
  };
}

export class LayoutValidationError extends Error {
  constructor(public readonly validationWarnings: string[]) {
    super(`Layout validation failed: ${validationWarnings.join("; ")}`);
    this.name = "LayoutValidationError";
  }
}

type RoomFunction = "living" | "kitchen" | "dining" | "bedroom" | "wc" | "garage" | "stair" | "corridor" | "balcony" | "other";

const ROOM_FUNCTION_MAP: Record<string, RoomFunction> = {
  "phòng khách": "living",
  "khách": "living",
  "living": "living",
  "bếp": "kitchen",
  "bếp + ăn": "kitchen",
  "kitchen": "kitchen",
  "phòng ăn": "dining",
  "ăn": "dining",
  "phòng ngủ": "bedroom",
  "pn": "bedroom",
  "master": "bedroom",
  "bedroom": "bedroom",
  "wc": "wc",
  "toilet": "wc",
  "nhà vệ sinh": "wc",
  "vệ sinh": "wc",
  "gara": "garage",
  "garage": "garage",
  "xe": "garage",
  "cầu thang": "stair",
  "stair": "stair",
  "thang": "stair",
  "hành lang": "corridor",
  "corridor": "corridor",
  "ban công": "balcony",
  "balcony": "balcony",
};

function classifyRoom(name: string): RoomFunction {
  const lower = name.toLowerCase().trim();
  for (const [key, fn] of Object.entries(ROOM_FUNCTION_MAP)) {
    if (lower.includes(key)) return fn;
  }
  return "other";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getSetback(landWidth: number): number {
  return landWidth <= 5 ? 1.2 : 1.4;
}

export function validateLayout(
  rooms: RoomInput[],
  landWidth: number,
  landLength: number
): string[] {
  const warnings: string[] = [];
  const landArea = landWidth * landLength;
  const totalRoomArea = rooms.reduce((sum, r) => sum + r.w * r.h, 0);

  if (totalRoomArea > landArea * 0.85) {
    warnings.push(
      `Tổng diện tích phòng (${totalRoomArea.toFixed(1)}m²) vượt quá 85% diện tích đất (${(landArea * 0.85).toFixed(1)}m²). Cần giảm kích thước phòng.`
    );
  }

  const WALL_T = 0.15;
  const EXT_T = 0.20;
  const usableWidth = landWidth - EXT_T * 2;
  const usableLength = landLength - EXT_T * 2;

  for (const r of rooms) {
    if (r.w > usableWidth) {
      warnings.push(
        `Phòng "${r.name}" rộng ${r.w}m vượt quá chiều rộng sử dụng ${usableWidth.toFixed(2)}m (sau khi trừ tường ngoài 2×${EXT_T}m).`
      );
    }
    if (r.h > usableLength) {
      warnings.push(
        `Phòng "${r.name}" dài ${r.h}m vượt quá chiều dài sử dụng ${usableLength.toFixed(2)}m (sau khi trừ tường ngoài 2×${EXT_T}m).`
      );
    }
  }

  let cursorX = EXT_T;
  let rowRoomNames: string[] = [];
  let rowSum = 0;

  for (const r of rooms) {
    if (r.w > usableWidth) {
      cursorX = EXT_T;
      rowRoomNames = [];
      rowSum = 0;
      continue;
    }

    const neededWidth = cursorX === EXT_T ? r.w : cursorX + r.w;

    if (neededWidth > landWidth - EXT_T + 0.01) {
      if (rowRoomNames.length > 0 && rowSum + WALL_T > usableWidth + 0.01) {
        warnings.push(
          `Hàng [${rowRoomNames.join(", ")}]: tổng chiều rộng phòng ${rowSum.toFixed(2)}m + tường ${WALL_T}m = ${(rowSum + WALL_T).toFixed(2)}m vượt chiều rộng sử dụng ${usableWidth.toFixed(2)}m.`
        );
      }
      cursorX = EXT_T;
      rowRoomNames = [];
      rowSum = 0;
    }

    rowRoomNames.push(r.name);
    rowSum += r.w;
    cursorX = round2(cursorX + r.w + WALL_T);
  }

  if (rowRoomNames.length > 0 && rowSum + WALL_T > usableWidth + 0.01) {
    warnings.push(
      `Hàng [${rowRoomNames.join(", ")}]: tổng chiều rộng ${rowSum.toFixed(2)}m + tường ${WALL_T}m = ${(rowSum + WALL_T).toFixed(2)}m vượt chiều rộng sử dụng ${usableWidth.toFixed(2)}m.`
    );
  }

  return warnings;
}

function positionRoomsOnFloor(
  rooms: RoomInput[],
  landWidth: number,
  landLength: number,
  isGroundFloor: boolean,
  existingCoords: boolean
): PositionedRoom[] {
  if (existingCoords) {
    return rooms.map((r, i) => ({
      id: `room-${i + 1}`,
      name: r.name,
      x: round2(r.x ?? 0),
      y: round2(r.y ?? 0),
      width: round2(r.w),
      height: round2(r.h),
      area: round2(r.w * r.h),
      function: classifyRoom(r.name),
    }));
  }

  const classified = rooms.map((r, i) => ({
    ...r,
    idx: i,
    fn: classifyRoom(r.name),
  }));

  const ORDER_GROUND: RoomFunction[] = ["garage", "living", "dining", "kitchen", "wc", "stair", "other"];
  const ORDER_UPPER: RoomFunction[] = ["stair", "corridor", "bedroom", "wc", "balcony", "other"];
  const order = isGroundFloor ? ORDER_GROUND : ORDER_UPPER;

  const sorted = [...classified].sort((a, b) => {
    const ai = order.indexOf(a.fn) >= 0 ? order.indexOf(a.fn) : order.length;
    const bi = order.indexOf(b.fn) >= 0 ? order.indexOf(b.fn) : order.length;
    return ai - bi;
  });

  const positioned: PositionedRoom[] = [];
  const EXT_T = 0.20;
  const usableWidth = landWidth - EXT_T * 2;
  let cursorX = EXT_T;
  let cursorY = EXT_T;
  let rowMaxH = 0;
  const WALL_T = 0.15;

  for (const r of sorted) {
    if (r.w > usableWidth) {
      console.warn(`[geometryEngine] CẢNH BÁO: Phòng "${r.name}" rộng ${r.w}m vượt chiều rộng sử dụng ${usableWidth}m — bỏ qua phòng này.`);
      continue;
    }

    if (cursorX > EXT_T && cursorX + r.w > landWidth - EXT_T - 0.01) {
      cursorX = EXT_T;
      cursorY = round2(cursorY + rowMaxH + WALL_T);
      rowMaxH = 0;
    }

    if (cursorX === EXT_T && r.w > usableWidth - 0.01) {
      console.warn(`[geometryEngine] CẢNH BÁO: Phòng "${r.name}" (${r.w}m) không vừa dòng mới tại x=${EXT_T} — bỏ qua.`);
      continue;
    }

    const rh = r.h;

    if (cursorY + rh > landLength + 0.5) {
      console.warn(`[geometryEngine] CẢNH BÁO: Phòng "${r.name}" tại y=${cursorY} vượt chiều dài khu đất ${landLength}m.`);
    }

    positioned.push({
      id: `room-${r.idx + 1}`,
      name: r.name,
      x: round2(cursorX),
      y: round2(cursorY),
      width: round2(r.w),
      height: round2(rh),
      area: round2(r.w * rh),
      function: r.fn,
    });

    cursorX = round2(cursorX + r.w + WALL_T);
    if (rh > rowMaxH) rowMaxH = rh;
  }

  return positioned;
}

function generateWalls(
  rooms: PositionedRoom[],
  landWidth: number,
  landLength: number
): Wall[] {
  const walls: Wall[] = [];
  let wIdx = 0;
  const EXT_T = 0.2;
  const INT_T = 0.12;

  walls.push(
    { id: `wall-ext-N`, x1: 0, y1: 0, x2: landWidth, y2: 0, thickness: EXT_T, type: "exterior" },
    { id: `wall-ext-S`, x1: 0, y1: landLength, x2: landWidth, y2: landLength, thickness: EXT_T, type: "exterior" },
    { id: `wall-ext-W`, x1: 0, y1: 0, x2: 0, y2: landLength, thickness: EXT_T, type: "exterior" },
    { id: `wall-ext-E`, x1: landWidth, y1: 0, x2: landWidth, y2: landLength, thickness: EXT_T, type: "exterior" }
  );

  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    for (let j = i + 1; j < rooms.length; j++) {
      const s = rooms[j];

      const xOverlapMin = Math.max(r.x, s.x);
      const xOverlapMax = Math.min(r.x + r.width, s.x + s.width);
      const yOverlapMin = Math.max(r.y, s.y);
      const yOverlapMax = Math.min(r.y + r.height, s.y + s.height);

      if (xOverlapMax - xOverlapMin > 0.3) {
        const sharedY1 = Math.abs(r.y + r.height - s.y) < 0.3;
        const sharedY2 = Math.abs(s.y + s.height - r.y) < 0.3;
        if (sharedY1 || sharedY2) {
          const wallY = sharedY1 ? r.y + r.height : s.y + s.height;
          walls.push({
            id: `wall-int-${wIdx++}`,
            x1: round2(xOverlapMin), y1: round2(wallY),
            x2: round2(xOverlapMax), y2: round2(wallY),
            thickness: INT_T, type: "interior",
          });
        }
      }

      if (yOverlapMax - yOverlapMin > 0.3) {
        const sharedX1 = Math.abs(r.x + r.width - s.x) < 0.3;
        const sharedX2 = Math.abs(s.x + s.width - r.x) < 0.3;
        if (sharedX1 || sharedX2) {
          const wallX = sharedX1 ? r.x + r.width : s.x + s.width;
          walls.push({
            id: `wall-int-${wIdx++}`,
            x1: round2(wallX), y1: round2(yOverlapMin),
            x2: round2(wallX), y2: round2(yOverlapMax),
            thickness: INT_T, type: "interior",
          });
        }
      }
    }
  }

  return walls;
}

function generateDoors(
  rooms: PositionedRoom[],
  walls: Wall[],
  isGroundFloor: boolean
): Door[] {
  const doors: Door[] = [];
  let dIdx = 0;

  const entranceRoom = rooms.find(r => r.function === "living") || rooms.find(r => r.function === "garage") || rooms[0];
  if (entranceRoom) {
    doors.push({
      id: `door-entrance`,
      wallId: `wall-ext-N`,
      x: round2(entranceRoom.x + (entranceRoom.width - 1.0) / 2),
      y: 0,
      width: 1.0,
      swing: "right",
      type: "entrance",
    });
  }

  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    if (r.function === "wc" || r.function === "stair" || r.function === "corridor") continue;

    for (let j = i + 1; j < rooms.length; j++) {
      const s = rooms[j];

      const xOverlapMin = Math.max(r.x, s.x);
      const xOverlapMax = Math.min(r.x + r.width, s.x + s.width);
      const yOverlapMin = Math.max(r.y, s.y);
      const yOverlapMax = Math.min(r.y + r.height, s.y + s.height);

      const isAdjH = xOverlapMax - xOverlapMin > 0.8 && Math.abs((r.y + r.height) - s.y) < 0.3;
      const isAdjV = yOverlapMax - yOverlapMin > 0.8 && Math.abs((r.x + r.width) - s.x) < 0.3;

      if (isAdjH || isAdjV) {
        const doorW = r.function === "bedroom" || s.function === "bedroom" ? 0.9 : 0.8;

        const matchingWall = walls.find(w => {
          if (isAdjH) {
            const wy = r.y + r.height;
            return Math.abs(w.y1 - wy) < 0.3 && Math.abs(w.y2 - wy) < 0.3 &&
              w.x1 <= xOverlapMin + 0.1 && w.x2 >= xOverlapMax - 0.1;
          } else {
            const wx = r.x + r.width;
            return Math.abs(w.x1 - wx) < 0.3 && Math.abs(w.x2 - wx) < 0.3 &&
              w.y1 <= yOverlapMin + 0.1 && w.y2 >= yOverlapMax - 0.1;
          }
        });

        if (matchingWall) {
          doors.push({
            id: `door-${dIdx++}`,
            wallId: matchingWall.id,
            x: isAdjH ? round2(xOverlapMin + (xOverlapMax - xOverlapMin - doorW) / 2) : round2(r.x + r.width),
            y: isAdjH ? round2(r.y + r.height) : round2(yOverlapMin + (yOverlapMax - yOverlapMin - doorW) / 2),
            width: doorW,
            swing: dIdx % 2 === 0 ? "left" : "right",
            type: "room",
          });
        }
        break;
      }
    }
  }

  return doors;
}

function generateWindows(
  rooms: PositionedRoom[],
  landWidth: number,
  landLength: number
): Window[] {
  const windows: Window[] = [];
  let wIdx = 0;

  for (const r of rooms) {
    if (r.function === "wc" || r.function === "stair" || r.function === "corridor") continue;

    if (Math.abs(r.y) < 0.3) {
      const windowW = Math.min(r.width * 0.5, 1.5);
      windows.push({
        id: `win-${wIdx++}`,
        wallId: `wall-ext-N`,
        x: round2(r.x + (r.width - windowW) / 2),
        y: 0,
        width: round2(windowW),
        height: 1.2,
      });
    }

    if (Math.abs(r.y + r.height - landLength) < 0.3) {
      const windowW = Math.min(r.width * 0.4, 1.2);
      windows.push({
        id: `win-${wIdx++}`,
        wallId: `wall-ext-S`,
        x: round2(r.x + (r.width - windowW) / 2),
        y: landLength,
        width: round2(windowW),
        height: 1.0,
      });
    }
  }

  return windows;
}

export function generateGeometry(
  landWidth: number,
  landLength: number,
  floorsInput: FloorInput[],
  requirements?: Record<string, boolean>
): GeometryResult {
  const setback = getSetback(landWidth);
  const warnings: string[] = [];
  let totalFloorArea = 0;

  for (const fl of floorsInput) {
    const floorValidationWarnings = validateLayout(fl.rooms, landWidth, landLength);
    if (floorValidationWarnings.length > 0) {
      floorValidationWarnings.forEach(w => {
        const msg = `Tầng ${fl.floor}: ${w}`;
        console.warn(`[geometryEngine] ${msg}`);
        warnings.push(msg);
      });
    }
  }

  const geometryFloors: GeometryFloor[] = floorsInput.map((fl) => {
    const isGround = fl.floor === 1;
    const hasCoords = fl.rooms.length > 0 && fl.rooms[0].x !== undefined && fl.rooms[0].y !== undefined;

    const positionedRooms = positionRoomsOnFloor(
      fl.rooms,
      landWidth,
      landLength,
      isGround,
      hasCoords
    );

    const walls = generateWalls(positionedRooms, landWidth, landLength);
    const doors = generateDoors(positionedRooms, walls, isGround);
    const windows = generateWindows(positionedRooms, landWidth, landLength);

    const totalArea = round2(positionedRooms.reduce((sum, r) => sum + r.area, 0));
    totalFloorArea += totalArea;

    const overflowY = positionedRooms.filter(r => r.y + r.height > landLength + 0.5);
    const overflowX = positionedRooms.filter(r => r.x + r.width > landWidth + 0.1);

    if (overflowY.length > 0) {
      const names = overflowY.map(r => `"${r.name}"`).join(", ");
      const overflowMsg = `Tầng ${fl.floor}: Phòng ${names} vượt quá chiều dài khu đất (${landLength}m) sau khi định vị.`;
      console.warn(`[geometryEngine] ${overflowMsg}`);
      warnings.push(overflowMsg);
    }
    if (overflowX.length > 0) {
      const names = overflowX.map(r => `"${r.name}"`).join(", ");
      const overflowMsg = `Tầng ${fl.floor}: Phòng ${names} vượt quá chiều rộng khu đất (${landWidth}m) sau khi định vị.`;
      console.warn(`[geometryEngine] ${overflowMsg}`);
      warnings.push(overflowMsg);
    }

    return {
      floor: fl.floor,
      rooms: positionedRooms,
      walls,
      doors,
      windows,
      totalArea,
      buildableArea: { x: 0, y: setback, width: landWidth, height: landLength - setback },
    };
  });

  const landArea = landWidth * landLength;
  const coverageRatio = round2((geometryFloors[0]?.totalArea || 0) / landArea);

  if (coverageRatio > 0.9) {
    warnings.push(`Mật độ xây dựng cao (${Math.round(coverageRatio * 100)}%), nên ≤ 70%`);
  }

  return {
    floors: geometryFloors,
    landWidth,
    landLength,
    setback,
    validation: {
      isValid: warnings.length === 0,
      warnings,
      totalFloorArea: round2(totalFloorArea),
      coverageRatio,
    },
  };
}
