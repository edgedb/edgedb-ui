import {
  Geometry,
  Point,
  LineString,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  CircularString,
  Box2D,
  Box3D,
} from "../../../../../web/node_modules/edgedb/dist/datatypes/postgis";
import {curveToLines} from "./editableGeom/curves";

import * as geojson from "./geojsonTypes";

function pointToCoords(point: Point, bounds: Bounds) {
  const p: [number, number] | [number, number, number] = point.z
    ? [point.x, point.y, point.z]
    : [point.x, point.y];
  extendBounds(bounds, p);
  return p;
}

export interface Metadata {
  minM: number;
  maxM: number;
}

export type Bounds = [[number, number], [number, number]];

function extendBounds(
  bounds: Bounds,
  point: [number, number] | [number, number, number]
) {
  if (bounds[0][0] > point[0]) bounds[0][0] = point[0];
  if (bounds[0][1] > point[1]) bounds[0][1] = point[1];
  if (bounds[1][0] < point[0]) bounds[1][0] = point[0];
  if (bounds[1][1] < point[1]) bounds[1][1] = point[1];
}
function extendBoundsPoint(bounds: Bounds, point: Point) {
  extendBounds(bounds, [point.x, point.y]);
}

export interface ToGeoJSONCtx {
  metadata: Metadata;
  bounds: Bounds;
  geoms: Geometry[];
  editMode?: boolean;
}

export function toGeoJSON(
  geom: Geometry | Box2D | Box3D,
  ctx: ToGeoJSONCtx
): geojson.Feature[] {
  if (geom instanceof Point) {
    const point: geojson.Point = {
      type: "Point",
      coordinates: pointToCoords(geom, ctx.bounds),
    };
    if (geom.m != null) {
      if (ctx.metadata.maxM < geom.m) ctx.metadata.maxM = geom.m;
      if (ctx.metadata.minM > geom.m) ctx.metadata.minM = geom.m;
    }
    return [
      {
        type: "Feature",
        properties:
          geom.m != null
            ? {
                mag: geom.m,
              }
            : null,
        geometry: point,
      },
    ];
  }
  if (geom instanceof CircularString) {
    const line: [number, number][] = [];
    const points: [number, number][] = [];
    for (let i = 0; i < geom.points.length - 1; i += 2) {
      const isFinal = i + 2 === geom.points.length - 1;
      line.push(
        ...curveToLines(
          geom.points[i],
          geom.points[i + 1],
          geom.points[i + 2],
          isFinal
        )
      );
      points.push(
        [geom.points[i].x, geom.points[i].y]
        // [geom.coordinates[i + 1].x, geom.coordinates[i + 1].y]
      );
      if (isFinal) {
        points.push([geom.points[i + 2].x, geom.points[i + 2].y]);
      }
    }
    return [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: line,
        },
        properties: {
          isCurve: true,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "MultiPoint",
          coordinates: points,
        },
        properties: {
          linePoints: true,
        },
      },
    ];
  }
  if (geom instanceof LineString) {
    return [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: geom.points.map((p) => pointToCoords(p, ctx.bounds)),
        },
      },
    ];
  }
  if (geom instanceof Polygon) {
    return [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: geom.rings.map((ring) =>
            ring.points.map((p) => pointToCoords(p, ctx.bounds))
          ),
        },
      },
    ];
  }
  if (geom instanceof MultiPoint) {
    if (geom.hasM) {
      return geom.geometries.flatMap((point) => toGeoJSON(point, ctx));
    } else {
      return [
        {
          type: "Feature",
          geometry: {
            type: "MultiPoint",
            coordinates: geom.geometries.map((p) =>
              pointToCoords(p, ctx.bounds)
            ),
          },
        },
      ];
    }
  }
  if (geom instanceof MultiLineString) {
    return [
      {
        type: "Feature",
        geometry: {
          type: "MultiLineString",
          coordinates: geom.geometries.map((lineString) =>
            lineString.points.map((p) => pointToCoords(p, ctx.bounds))
          ),
        },
      },
    ];
  }
  if (geom instanceof MultiPolygon) {
    if (ctx.editMode) {
      return geom.geometries.map((polygon) => ({
        type: "Feature",
        id: ctx.geoms.push(polygon) - 1,
        geometry: {
          type: "Polygon",
          coordinates: polygon.rings.map((ring) =>
            ring.points.map((p) => pointToCoords(p, ctx.bounds))
          ),
        },
      }));
    } else {
      return [
        {
          type: "Feature",
          id: ctx.geoms.push(geom) - 1,
          geometry: {
            type: "MultiPolygon",
            coordinates: geom.geometries.map((polygon) =>
              polygon.rings.map((ring) =>
                ring.points.map((p) => pointToCoords(p, ctx.bounds))
              )
            ),
          },
        },
      ];
    }
  }
  if (geom instanceof Box2D || geom instanceof Box3D) {
    extendBounds(ctx.bounds, geom.min);
    extendBounds(ctx.bounds, geom.max);
    return [
      {
        type: "Feature",
        properties: {
          isBoxType: true,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [geom.min[0], geom.min[1]],
              [geom.min[0], geom.max[1]],
              [geom.max[0], geom.max[1]],
              [geom.max[0], geom.min[1]],
              [geom.min[0], geom.min[1]],
            ],
          ],
        },
      },
    ];
  }
  return [];
}
