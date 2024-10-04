import * as PostGIS from "../../../../../../web/node_modules/edgedb/dist/datatypes/postgis";
import {
  Geometry,
  Point,
  Polygon,
  PlainPoint,
  LineString,
  MultiGeometry,
  CompoundCurve,
} from "./types";
import {pointsEqual} from "./utils";

export function convertToEditableGeometry(geom: PostGIS.Geometry): {
  geometry: Geometry;
  mapping: GeomMapping;
  hasZ: boolean;
  hasM: boolean;
} {
  const ctx: ConvertCtx = {
    mapping: new GeomMapping(),
  };
  const geometry = _convert(geom as PostGIS.AnyGeometry, ctx);
  return {
    geometry,
    mapping: ctx.mapping,
    hasZ: (geom as PostGIS.Geometry).hasZ,
    hasM: (geom as PostGIS.Geometry).hasM,
  };
}

export class GeomMapping {
  private idCounter = 1;
  private mapping = new Map<number, Geometry>();

  constructor() {}

  addGeom<T extends Geometry>(makeGeom: (id: number) => T): T {
    const id = this.idCounter++;
    const geom = makeGeom(id);
    this.mapping.set(id, geom);
    return geom;
  }

  getGeom(id: number) {
    return this.mapping.get(id) ?? null;
  }

  removeGeom(id: number) {
    this.mapping.delete(id);
  }

  clear() {
    this.mapping.clear();
    this.idCounter = 0;
  }
}

interface ConvertCtx {
  mapping: GeomMapping;
}

function makePoint(
  ctx: ConvertCtx,
  point: PostGIS.Point,
  controlPoint: boolean
) {
  return ctx.mapping.addGeom(
    (id) =>
      new Point(
        id,
        point.z != null ? [point.x, point.y, point.z] : [point.x, point.y],
        point.m,
        controlPoint
      )
  );
}

function makeMultiGeom(
  ctx: ConvertCtx,
  geom:
    | PostGIS.MultiPoint
    | PostGIS.MultiLineString
    | PostGIS.MultiPolygon
    | PostGIS.GeometryCollection,
  kind:
    | "MultiPoint"
    | "MultiLineString"
    | "MultiPolygon"
    | "GeometryCollection"
): MultiGeometry {
  return ctx.mapping.addGeom(
    (id) =>
      new MultiGeometry(
        id,
        kind,
        geom.geometries.map((poly) => _convert(poly, ctx) as Polygon)
      )
  );
}

function postgisPointsEqual(p1: PostGIS.Point, p2: PostGIS.Point) {
  return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z;
}

function _convert(geom: PostGIS.AnyGeometry, ctx: ConvertCtx): Geometry {
  if (geom instanceof PostGIS.Point) {
    return makePoint(ctx, geom, false);
  }

  if (geom instanceof PostGIS.LineString) {
    const isCircularString = geom instanceof PostGIS.CircularString;
    const isClosed =
      geom.points.length > 1 &&
      postgisPointsEqual(geom.points[0], geom.points[geom.points.length - 1]);
    return ctx.mapping.addGeom(
      (id) =>
        new LineString(
          id,
          isCircularString ? "CircularString" : "LineString",
          (isClosed ? geom.points.slice(0, -1) : geom.points).map((p, i) =>
            makePoint(ctx, p, isCircularString && i % 2 === 1)
          ),
          isClosed
        )
    );
  }

  if (geom instanceof PostGIS.CompoundCurve) {
    return ctx.mapping.addGeom((id) => {
      const lines: LineString[] = [];
      let firstPoint: Point | null = null;
      let lastPoint: Point | null = null;
      for (const line of geom.geometries) {
        const isCircularString = line instanceof PostGIS.CircularString;
        const lineString = ctx.mapping.addGeom(
          (id) =>
            new LineString(
              id,
              isCircularString ? "CircularString" : "LineString",
              line.points.map((p, i) =>
                i === 0 && lastPoint
                  ? lastPoint
                  : makePoint(ctx, p, isCircularString && i % 2 === 1)
              )
            )
        );
        lastPoint = lineString.points.length
          ? lineString.points[lineString.points.length - 1]
          : lastPoint;
        firstPoint =
          !firstPoint && lineString.points.length
            ? lineString.points[0]
            : firstPoint;
        lines.push(lineString);
      }
      return new CompoundCurve(
        id,
        lines,
        firstPoint != null &&
          lastPoint != null &&
          firstPoint !== lastPoint &&
          pointsEqual(firstPoint.point, lastPoint.point)
      );
    });
  }

  if (geom instanceof PostGIS.Polygon) {
    return ctx.mapping.addGeom(
      (id) =>
        new Polygon(
          id,
          geom instanceof PostGIS.Triangle ? "Triangle" : "Polygon",
          geom.rings.map((ring) => _convert(ring, ctx) as LineString)
        )
    );
  }

  if (geom instanceof PostGIS.MultiPoint) {
    return makeMultiGeom(ctx, geom, "MultiPoint");
  }
  if (geom instanceof PostGIS.MultiLineString) {
    return makeMultiGeom(ctx, geom, "MultiLineString");
  }
  if (geom instanceof PostGIS.MultiPolygon) {
    return makeMultiGeom(ctx, geom, "MultiPolygon");
  }
  if (geom instanceof PostGIS.GeometryCollection) {
    return makeMultiGeom(ctx, geom, "GeometryCollection");
  }

  throw new Error(`unhandled geometry type: ${geom.constructor.name}`);
}
