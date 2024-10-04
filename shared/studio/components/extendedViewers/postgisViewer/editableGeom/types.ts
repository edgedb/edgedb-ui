import {computed, makeObservable, observable} from "mobx";
import * as geojson from "../geojsonTypes";
import {Bounds, pointsEqual} from "./utils";
import {GeomMapping} from "./convert";
import {curveToLines} from "./curves";

export interface ListItemWrapper {
  id: number;
  kind: "__Point" | "__ListItemEndPlaceholder";
  geom: Geometry;
}

export type ListItem = Geometry | ListItemWrapper;

interface BaseGeometry {
  readonly id: number;
  readonly kind: string;
  parent: Geometry | null;

  bounds: Bounds | null;
  recalculateBounds: () => void;

  geojson: geojson.Feature[];
  featureIds: number[];

  translate(by: [number, number]): void;

  listItemExpanded: boolean;
  listDepth: number;
  listItems: ListItem[];
}

interface ActiveLineEdit {
  pendingPoints: PlainPoint[];
  mousePoint: PlainPoint;
  prepend: boolean;
}

interface EditableGeom {
  editingGeojson(activeEdit: ActiveLineEdit | null): geojson.Feature[];
}

export type PlainPoint = [number, number] | [number, number, number];

export class Point implements BaseGeometry {
  parent: Geometry | null = null;
  geojson: geojson.Feature[];
  featureIds: number[];
  listItemExpanded: boolean = true;

  get kind() {
    return "Point" as const;
  }

  get logicalParent() {
    return this.parent?.parent instanceof Polygon
      ? this.parent.parent
      : this.parent;
  }

  constructor(
    public readonly id: number,
    public point: PlainPoint,
    public m: number | null,
    public controlPoint: boolean = false
  ) {
    makeObservable(this, {
      parent: observable.shallow,
      point: observable,
      m: observable,
    });
    this.geojson = [
      {
        type: "Feature",
        id,
        properties: {
          ...(m != null
            ? {
                mag: m,
              }
            : null),
          ...(controlPoint ? {isControlPoint: true} : null),
        },
        geometry: {
          type: "Point",
          coordinates: this.point,
        },
      },
    ];
    this.featureIds = [id];
  }

  get bounds(): Bounds {
    return new Bounds([
      [this.point[0], this.point[1]],
      [this.point[0], this.point[1]],
    ]);
  }

  recalculateBounds() {}

  translate(by: [number, number], updateParent = true) {
    this.point[0] += by[0];
    this.point[1] += by[1];
    if (updateParent && this.parent instanceof LineString) {
      this.parent.onPointUpdate();
    }
  }

  get listDepth(): number {
    return (this.parent?.listDepth ?? -1) + 1;
  }

  get listItems(): ListItem[] {
    return [this];
  }
}

export class LineString implements BaseGeometry, EditableGeom {
  parent: Geometry | null = null;
  bounds: Bounds | null = null;
  _renderPoints: PlainPoint[];
  listItemExpanded: boolean = true;

  constructor(
    public readonly id: number,
    public readonly kind: "LineString" | "CircularString",
    public points: Point[],
    public isClosed: boolean = false
  ) {
    makeObservable(this, {
      parent: observable.shallow,
      points: observable.shallow,
      listItemExpanded: observable,
      listDepth: computed,
      listItems: computed,
    });
    for (const point of points) {
      point.parent = this;
    }
    this._renderPoints = this.calculateRenderPoints();
    this.recalculateBounds();
  }

  get featureIds() {
    return [this.id];
  }

  private calculateRenderPoints(): PlainPoint[] {
    let line: PlainPoint[];
    const points =
      this.isClosed && this.points.length > 1
        ? [...this.points, this.points[0]]
        : this.points;
    if (this.kind == "LineString") {
      line = points.map((p) => p.point);
    } else {
      line = [];
      for (let i = 0; i < points.length - 2; i += 2) {
        const isFinal = i + 2 >= points.length - 2;
        line.push(
          ...curveToLines(
            points[i].point,
            points[i + 1].point,
            points[i + 2].point,
            isFinal
          )
        );
      }
    }
    return line;
  }

  recalculateBounds() {
    const bounds = new Bounds();
    for (const point of this._renderPoints) {
      bounds.extend(point);
    }
    this.bounds = bounds;
    this.parent?.recalculateBounds();
  }

  private _makeGeojson(): geojson.Feature[] {
    return [
      {
        type: "Feature",
        id: this.id,
        geometry: {
          type: "LineString",
          coordinates: this._renderPoints,
        },
      },
    ];
  }

  private _geojson: geojson.Feature[] | null = null;
  get geojson() {
    if (!this._geojson) {
      this._geojson = this._makeGeojson();
    }
    return this._geojson;
  }

  onPointUpdate() {
    if (this.kind === "LineString") return;
    this._renderPoints = this.calculateRenderPoints();
    this._geojson = this._makeGeojson();
  }

  _editingRenderPoints(edit: ActiveLineEdit) {
    const points: PlainPoint[] =
      this.kind === "LineString" || !edit.pendingPoints.length
        ? edit.prepend
          ? [edit.mousePoint, this.points[0].point]
          : [this.points[this.points.length - 1].point, edit.mousePoint]
        : edit.prepend
        ? curveToLines(
            edit.pendingPoints[0],
            edit.mousePoint,
            this.points[0].point,
            true
          )
        : curveToLines(
            this.points[this.points.length - 1].point,
            edit.mousePoint,
            edit.pendingPoints[0],
            true
          );
    if (this.isClosed) {
      if (edit.prepend) {
        points.unshift(this.points[this.points.length - 1].point);
      } else {
        points.push(this.points[0].point);
      }
    }
    return points;
  }

  editingGeojson(edit: ActiveLineEdit | null) {
    const features: geojson.Feature[] = [
      {
        type: "Feature",
        geometry:
          edit && this.isClosed && this.kind === "LineString"
            ? {
                type: "LineString",
                coordinates: this._renderPoints.slice(0, -1),
              }
            : this.geojson[0].geometry,
      },
      ...this.points.flatMap((point) => point.geojson),
    ];
    if (edit) {
      features.push(
        {
          type: "Feature",
          properties: {pendingLine: true},
          geometry: {
            type: "LineString",
            coordinates: this._editingRenderPoints(edit),
          },
        },
        {
          type: "Feature",
          properties: edit.pendingPoints.length
            ? {isControlPoint: true}
            : null,
          geometry: {
            type: "Point",
            coordinates: edit.mousePoint,
          },
        },
        ...edit.pendingPoints.map(
          (p) =>
            ({
              type: "Feature",
              geometry: {type: "Point", coordinates: p},
            } as geojson.Feature)
        )
      );
    }
    return features;
  }

  addPoint(edit: ActiveLineEdit, mapping: GeomMapping): ActiveLineEdit | null {
    let p = edit.mousePoint;

    const endPoint = edit.prepend
      ? this.points[0]
      : this.points[this.points.length - 1];
    if (
      !edit.pendingPoints.length &&
      pointsEqual(edit.mousePoint, endPoint.point)
    ) {
      // clicked on end of line so exit editing
      return null;
    }

    if (this.kind === "CircularString") {
      if (!edit.pendingPoints.length) {
        return {
          pendingPoints: [edit.mousePoint],
          prepend: edit.prepend,
          mousePoint: edit.mousePoint,
        };
      }

      const cpoint = mapping.addGeom(
        (id) => new Point(id, [...edit.mousePoint], null, true)
      );
      cpoint.parent = this;
      if (edit.prepend) {
        this.points.unshift(cpoint);
      } else {
        this.points.push(cpoint);
      }
      p = edit.pendingPoints[0];
    }

    const startPoint = edit.prepend
      ? this.points[this.points.length - 1]
      : this.points[0];
    let closed = false;
    if (pointsEqual(p, startPoint.point)) {
      // close the line and exit editing
      closed = true;
      this.isClosed = true;
    } else {
      const point = mapping.addGeom((id) => new Point(id, [...p], null));
      point.parent = this;
      if (edit.prepend) {
        this.points.unshift(point);
      } else {
        this.points.push(point);
      }
    }

    this._renderPoints = this.calculateRenderPoints();
    this._geojson = this._makeGeojson();
    if (this.parent instanceof Polygon) {
      this.parent._updateGeojson();
    }
    this.recalculateBounds();

    return closed ||
      (this.parent?.kind === "Triangle" && this.points.length === 3)
      ? null
      : {
          pendingPoints: [],
          prepend: edit.prepend,
          mousePoint: edit.mousePoint,
        };
  }

  finaliseEditing(mapping: GeomMapping) {
    if (
      this.kind === "CircularString" &&
      this.isClosed &&
      this.points.length % 2 !== 0
    ) {
      const start = this.points[0].point;
      const end = this.points[this.points.length - 1].point;
      const point = mapping.addGeom(
        (id) =>
          new Point(
            id,
            [
              start[0] + (end[0] - start[0]) / 2,
              start[1] + (end[1] - start[1]) / 2,
            ],
            null,
            true
          )
      );
      point.parent = this;
      this.points.push(point);
      this._renderPoints = this.calculateRenderPoints();
      this._geojson = this._makeGeojson();
      if (this.parent instanceof Polygon) {
        this.parent._updateGeojson();
      }
    }
  }

  removePoints(points: Geometry[], mapping: GeomMapping) {
    for (const point of points) {
      const pointIndex = this.points.indexOf(point as Point);
      if (pointIndex === -1) continue;
      this.points.splice(pointIndex, 1);
      mapping.removeGeom(point.id);
      if (this.kind === "CircularString") {
        if (this.points.length === 0) continue;
        if (pointIndex === this.points.length) {
          mapping.removeGeom(this.points.pop()!.id);
        } else {
          mapping.removeGeom(this.points.splice(pointIndex, 1)[0].id);
        }
      }
    }
    this._renderPoints = this.calculateRenderPoints();
    this._geojson = this._makeGeojson();
    if (this.parent instanceof Polygon) {
      this.parent._updateGeojson();
    }
    this.recalculateBounds();
  }

  translate(by: [number, number]) {
    const points = new Set<PlainPoint>();
    for (const point of this.points) {
      point.translate(by, false);
      points.add(point.point);
    }
    for (const point of this._renderPoints) {
      if (!points.has(point)) {
        point[0] += by[0];
        point[1] += by[1];
      }
    }
    this.bounds?.translate(by);
  }

  get listDepth(): number {
    return (this.parent?.listDepth ?? -1) + 1;
  }

  get listItems(): ListItem[] {
    return this.listItemExpanded
      ? [
          this,
          ...this.points,
          ...(this.isClosed && this.points.length
            ? [
                {
                  id: this.id + 0.1,
                  kind: "__Point",
                  geom: this.points[0],
                } as const,
              ]
            : []),
          {id: this.id + 0.5, kind: "__ListItemEndPlaceholder", geom: this},
        ]
      : [this];
  }
}

export class CompoundCurve implements BaseGeometry, EditableGeom {
  parent: Geometry | null = null;
  bounds: Bounds | null = null;
  listItemExpanded: boolean = false;

  get kind() {
    return "CompoundCurve" as const;
  }

  constructor(
    public readonly id: number,
    public lines: LineString[],
    public isClosed: boolean = false
  ) {
    makeObservable(this, {
      parent: observable.shallow,
      lines: observable.shallow,
      listItemExpanded: observable,
      listDepth: computed,
      listItems: computed,
    });
    for (const line of lines) {
      line.parent = this;
    }
    this.recalculateBounds();
  }

  get featureIds() {
    return [this.id];
  }

  recalculateBounds() {
    let bounds: Bounds | null = null;
    for (const line of this.lines) {
      if (!line.bounds) continue;
      if (!bounds) {
        bounds = line.bounds.copy();
      } else {
        bounds.join(line.bounds);
      }
    }
    this.bounds = bounds;
    this.parent?.recalculateBounds();
  }

  private _makeGeojson(): geojson.Feature[] {
    return [
      {
        type: "Feature",
        id: this.id,
        geometry: {
          type: "LineString",
          coordinates: this.lines.flatMap((line, i) =>
            i < this.lines.length - 1
              ? line._renderPoints.slice(0, -1)
              : line._renderPoints
          ),
        },
      },
    ];
  }

  private _geojson: geojson.Feature[] | null = null;
  get geojson() {
    if (!this._geojson) {
      this._geojson = this._makeGeojson();
    }
    return this._geojson;
  }

  _updateGeojson() {
    this._geojson = this._makeGeojson();
  }

  get _points() {
    return this.lines.flatMap((line, i) =>
      i < this.lines.length - 1 ? line.points.slice(0, -1) : line.points
    );
  }

  editingGeojson(activeEdit: ActiveLineEdit | null): geojson.Feature[] {
    throw new Error("Method not implemented.");
  }

  translate(by: [number, number]): void {
    throw new Error("Method not implemented.");
  }

  get listDepth(): number {
    return (this.parent?.listDepth ?? -1) + 1;
  }

  get listItems(): ListItem[] {
    return this.listItemExpanded
      ? [
          this,
          ...this.lines.flatMap((line) => line.listItems),
          {id: this.id + 0.5, kind: "__ListItemEndPlaceholder", geom: this},
        ]
      : [this];
  }
}

export class Polygon implements BaseGeometry, EditableGeom {
  parent: Geometry | null = null;
  bounds: Bounds | null = null;
  listItemExpanded: boolean = true; //false;

  constructor(
    public readonly id: number,
    public readonly kind: "Polygon" | "Triangle",
    public rings: LineString[]
  ) {
    makeObservable(this, {
      parent: observable.shallow,
      rings: observable.shallow,
      listItemExpanded: observable,
      listDepth: computed,
      listItems: computed,
    });
    for (const ring of rings) {
      ring.parent = this;
    }
    this.recalculateBounds();
  }

  get featureIds() {
    return [this.id];
  }

  recalculateBounds() {
    let bounds: Bounds | null = null;
    for (const ring of this.rings) {
      if (!ring.bounds) continue;
      if (!bounds) {
        bounds = ring.bounds.copy();
      } else {
        bounds.join(ring.bounds);
      }
    }
    this.bounds = bounds;
    this.parent?.recalculateBounds();
  }

  private _makeGeojson(): geojson.Feature[] {
    return [
      {
        type: "Feature",
        id: this.id,
        geometry: {
          type: "Polygon",
          coordinates: this.rings.map((ring) => ring._renderPoints),
        },
      },
    ];
  }

  private _geojson: geojson.Feature[] | null = null;
  get geojson() {
    if (!this._geojson) {
      this._geojson = this._makeGeojson();
    }
    return this._geojson;
  }

  _updateGeojson() {
    this._geojson = this._makeGeojson();
  }

  editingGeojson(edit: (ActiveLineEdit & {line: LineString}) | null) {
    return [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: this.rings.map((ring) =>
            edit?.line === ring
              ? [
                  ...ring._renderPoints.slice(0, -1),
                  ...ring._editingRenderPoints(edit).slice(1),
                ]
              : ring._renderPoints
          ),
        },
      },
      ...this.rings.flatMap((ring) =>
        ring.editingGeojson(edit?.line === ring ? edit : null)
      ),
    ] as geojson.Feature[];
  }

  addRing(ring: LineString) {
    this.rings.push(ring);
    ring.parent = this;
    this._geojson = this._makeGeojson();
    this.recalculateBounds();
  }

  translate(by: [number, number]) {
    for (const ring of this.rings) {
      ring.translate(by);
    }
    this.bounds?.translate(by);
  }

  get listDepth(): number {
    return (this.parent?.listDepth ?? -1) + 1;
  }

  get listItems(): ListItem[] {
    console.log("calculating polygon list items");
    return this.listItemExpanded
      ? [
          this,
          ...this.rings.flatMap((ring) => ring.listItems),
          {id: this.id + 0.5, kind: "__ListItemEndPlaceholder", geom: this},
        ]
      : [this];
  }
}

export class MultiGeometry<ChildGeometry extends Geometry = Geometry>
  implements BaseGeometry, EditableGeom
{
  parent: Geometry | null = null;
  bounds: Bounds | null = null;
  listItemExpanded: boolean = true;

  constructor(
    public readonly id: number,
    public kind:
      | "GeometryCollection"
      | "MultiPoint"
      | "MultiLineString"
      | "MultiPolygon",
    public geoms: ChildGeometry[]
  ) {
    makeObservable(this, {
      parent: observable.shallow,
      geoms: observable.shallow,
      listItemExpanded: observable,
      listDepth: computed,
      listItems: computed,
    });
    for (const geom of geoms) {
      geom.parent = this;
    }
    this.recalculateBounds();
  }

  get featureIds(): number[] {
    return this.geoms.flatMap((geom) => geom.featureIds);
  }

  recalculateBounds() {
    let bounds: Bounds | null = null;
    for (const geom of this.geoms) {
      if (!geom.bounds) continue;
      if (!bounds) {
        bounds = geom.bounds.copy();
      } else {
        bounds.join(geom.bounds);
      }
    }
    this.bounds = bounds;
    this.parent?.recalculateBounds();
  }

  private _geojson: geojson.Feature[] | null = null;
  get geojson(): geojson.Feature[] {
    if (!this._geojson) {
      this.updateGeojson();
    }
    return this._geojson!;
  }

  updateGeojson() {
    this._geojson = this.geoms.flatMap((geom) => geom.geojson);
    if (this.parent instanceof MultiGeometry) {
      this.parent.updateGeojson();
    }
  }

  editingGeojson() {
    return this.geojson;
  }

  translate(by: [number, number]) {
    for (const geom of this.geoms) {
      geom.translate(by);
    }
    this.bounds?.translate(by);
  }

  insertGeom(geom: ChildGeometry): void {
    this.geoms.push(geom);
    geom.parent = this;
    this._geojson = this.geoms.flatMap((geom) => geom.geojson);
    this.recalculateBounds();
  }

  removeGeoms(geoms: ChildGeometry[], mapping: GeomMapping): void {
    for (const geom of geoms) {
      const geomIndex = this.geoms.indexOf(geom);
      if (geomIndex === -1) continue;
      this.geoms.splice(geomIndex, 1);
      mapping.removeGeom(geom.id);
    }
    this._geojson = this.geoms.flatMap((geom) => geom.geojson);
    this.recalculateBounds();
  }

  replaceGeoms(oldGeoms: ChildGeometry[], newGeoms: ChildGeometry[]): void {
    const geomIndex = this.geoms.indexOf(oldGeoms[0]);
    if (geomIndex === -1) return;
    this.geoms.splice(geomIndex, 1, ...newGeoms);
    for (const g of newGeoms) {
      g.parent = this;
    }
    for (const geom of oldGeoms.slice(1)) {
      const geomIndex = this.geoms.indexOf(geom);
      if (geomIndex === -1) continue;
      this.geoms.splice(geomIndex, 1);
    }
    this._geojson = this.geoms.flatMap((geom) => geom.geojson);
    this.recalculateBounds();
  }

  get listDepth(): number {
    return (this.parent?.listDepth ?? -1) + 1;
  }

  get listItems(): ListItem[] {
    return this.listItemExpanded
      ? [
          this,
          ...this.geoms.flatMap((geom) => geom.listItems),
          {id: this.id + 0.5, kind: "__ListItemEndPlaceholder", geom: this},
        ]
      : [this];
  }
}

export type Geometry =
  | Point
  | LineString
  | CompoundCurve
  | Polygon
  | MultiGeometry;
export type EditableGeometry = Exclude<Geometry, Point>;
