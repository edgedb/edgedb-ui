import {PlainPoint} from "./types";

function calcNormal(p1: PlainPoint, p2: PlainPoint) {
  const chordSlope = (p2[1] - p1[1]) / (p2[0] - p1[0]);
  const normalSlope = -1 / chordSlope;
  const center: PlainPoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const intercept = center[1] - normalSlope * center[0];

  return {slope: normalSlope, intercept};
}

function dist(p1: PlainPoint, p2: PlainPoint): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function calcCircle(
  p1: PlainPoint,
  p2: PlainPoint,
  p3: PlainPoint
): {center: PlainPoint; radius: number; direction: number} | null {
  const n1 = calcNormal(p1, p2);
  const n2 = calcNormal(p2, p3);

  if (n1.slope == n2.slope) return null;

  let center: PlainPoint;

  if (n1.slope === Infinity || n1.slope === -Infinity) {
    const cx = (p2[0] + p1[0]) / 2;
    center = [cx, n2.slope * cx + n2.intercept];
  } else if (n2.slope === Infinity || n2.slope === -Infinity) {
    const cx = (p3[0] + p2[0]) / 2;
    center = [cx, n1.slope * cx + n1.intercept];
  } else {
    const cx = (n2.intercept - n1.intercept) / (n1.slope - n2.slope);
    const cy = n1.slope * cx + n1.intercept;
    center = [cx, cy];
  }

  return {
    center,
    radius: dist(center, p1),
    direction: Math.sign(
      (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])
    ),
  };
}

const incrementAngle = 0.05;

export function curveToLines(
  p1: PlainPoint,
  p2: PlainPoint,
  p3: PlainPoint,
  includeLastPoint: boolean
): PlainPoint[] {
  const circle = calcCircle(p1, p2, p3);

  if (!circle) {
    return [p1, p3];
  }

  const {center, radius, direction} = circle;

  const points: PlainPoint[] = [p1];
  let angle = Math.atan2(p1[1] - center[1], p1[0] - center[0]);
  let angleDiff = Math.atan2(p3[1] - center[1], p3[0] - center[0]) - angle;
  if (Math.sign(angleDiff) == direction) {
    angleDiff += 2 * Math.PI * -direction;
  }
  const pointCount = Math.floor(Math.abs(angleDiff) / incrementAngle);
  for (let i = 0; i < pointCount; i++) {
    angle += incrementAngle * -direction;
    points.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ]);
  }
  if (includeLastPoint) {
    points.push(p3);
  }

  return points;
}
