export type GeoJSON = Geometry | Feature | FeatureCollection;

export type Geometry =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon
  | GeometryCollection;
export type GeometryObject = Geometry;

export type Position = [number, number] | [number, number, number];

export interface Point {
  type: "Point";
  coordinates: Position;
}
export interface MultiPoint {
  type: "MultiPoint";
  coordinates: Position[];
}

export interface LineString {
  type: "LineString";
  coordinates: Position[];
}
export interface MultiLineString {
  type: "MultiLineString";
  coordinates: Position[][];
}

export interface Polygon {
  type: "Polygon";
  coordinates: Position[][];
}
export interface MultiPolygon {
  type: "MultiPolygon";
  coordinates: Position[][][];
}

export interface GeometryCollection {
  type: "GeometryCollection";
  geometries: Geometry[];
}

export type GeoJsonProperties = {[name: string]: any} | null;

export interface Feature {
  type: "Feature";
  geometry: Geometry;
  id?: number;
  properties?: GeoJsonProperties;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}
