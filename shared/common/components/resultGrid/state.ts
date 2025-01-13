import {ICodec} from "edgedb/dist/codecs/ifaces";
import {ObjectCodec} from "edgedb/dist/codecs/object";
import {SetCodec} from "edgedb/dist/codecs/set";
import {DataGridState} from "../dataGrid/state";
import {assertNever} from "../../utils/assertNever";
import {NamedTupleCodec} from "edgedb/dist/codecs/namedtuple";
import {RecordCodec} from "edgedb/dist/codecs/record";

export function createResultGridState(codec: ICodec, data: any[]) {
  return new ResultGridState(codec, data);
}

export const RowHeight = 40;

export interface GridHeader {
  id: string;
  parent: GridHeader | null;
  name: string | null;
  key: string | number | null;
  multi: boolean;
  codec: ICodec;
  typename: string;
  depth: number;
  startIndex: number;
  span: number;
  subHeaders: GridHeader[] | null;
}

export class ResultGridState {
  grid: DataGridState;

  _headers: GridHeader[];
  allHeaders: GridHeader[];
  flatHeaders: GridHeader[];
  maxDepth: number;

  rowTops = new Map<any[], number[]>();
  rowCount: number;

  constructor(codec: ICodec, public data: any[]) {
    // makeObservable(this);

    const {headers} = _getHeaders(codec, null);
    this._headers = headers;
    this.allHeaders = _flattenHeaders(this._headers);
    this.flatHeaders = this.allHeaders.filter((h) => h.subHeaders == null);

    this.maxDepth = Math.max(...this.flatHeaders.map((h) => h.depth));

    this.rowCount = _getRowTops(this.rowTops, data, this._headers);

    this.grid = new DataGridState(
      RowHeight,
      () => this.flatHeaders,
      () => [],
      () => this.rowCount
    );
  }

  getData(
    header: GridHeader,
    rowIndex: number
  ): {data: any[]; indexOffset: number; endIndex: number} {
    if (!header.parent) {
      return {
        data: this.data,
        indexOffset: 0,
        endIndex: this.rowCount,
      };
    }
    const {data: parentData, indexOffset} = this.getData(
      header.parent,
      rowIndex
    );
    const offsetRowIndex = rowIndex - indexOffset;
    const tops = this.rowTops.get(parentData);
    const dataIndex = tops
      ? tops.findIndex((top) => top > offsetRowIndex) - 1
      : offsetRowIndex;
    return {
      data: parentData[dataIndex]?.[header.parent.key!] ?? [],
      indexOffset: indexOffset + (tops ? tops[dataIndex] : dataIndex),
      endIndex: indexOffset + (tops ? tops[dataIndex + 1] : dataIndex + 1),
    };
  }
}

function _getRowTops(
  topsMap: Map<any[], number[]>,
  items: any[],
  headers: GridHeader[]
): number {
  let top = 0;
  let dense = true;
  const tops: number[] = [0];
  for (const item of items) {
    let height = 1;
    for (const header of headers) {
      if (!header.multi) continue;
      const colHeight =
        header.subHeaders && header.subHeaders[0].name !== null
          ? _getRowTops(topsMap, item[header.key!], header.subHeaders)
          : item[header.key!].length;
      if (colHeight > height) {
        height = colHeight;
      }
    }
    const itemTop = (top += height);
    dense = dense && itemTop === tops.length;
    tops.push(itemTop);
  }
  if (!dense) {
    topsMap.set(items, tops);
  }
  return tops[tops.length - 1];
}

function _getHeaders(
  codec: ICodec,
  parent: GridHeader | null,
  depth = 0,
  indexStart = 0
): {headers: GridHeader[]; colCount: number} {
  if (codec instanceof ObjectCodec) {
    const subcodecs = codec.getSubcodecs();
    const headers: GridHeader[] = [];
    let colCount = 0;
    let i = 0;
    const fields = codec.getFields();
    const showImplicitId = fields.every((field) => field.implicit);
    for (const field of fields) {
      let subcodec = subcodecs[i++];
      if (!field.implicit || (showImplicitId && field.name === "id")) {
        let multi = false;
        if (subcodec instanceof SetCodec) {
          multi = true;
          subcodec = subcodec.getSubcodecs()[0];
        }
        const startIndex = indexStart + colCount;
        const header: GridHeader = {
          id: parent ? `${parent.id}.${field.name}` : field.name,
          parent,
          name: field.name,
          key: field.name,
          multi,
          codec: subcodec,
          typename: getTypename(subcodec),
          depth,
          startIndex,
          span: 1,
          subHeaders: null,
        };
        headers.push(header);
        if (subcodec instanceof ObjectCodec) {
          const subheaders = _getHeaders(
            subcodec,
            header,
            depth + 1,
            startIndex
          );
          header.span = subheaders.colCount;
          header.subHeaders = subheaders.headers;
          colCount += subheaders.colCount;
        } else {
          if (multi) {
            header.subHeaders = [
              {
                id: `${header.id}.__multi__`,
                parent: header,
                name: null,
                key: null,
                multi: false,
                codec: subcodec,
                typename: getTypename(subcodec),
                depth,
                startIndex,
                span: 1,
                subHeaders: null,
              },
            ];
          }
          colCount++;
        }
      }
    }
    return {headers, colCount};
  } else if (codec instanceof RecordCodec) {
    const subcodecs = codec.getSubcodecs();
    const headers: GridHeader[] = [];
    let i = 0;
    const names = codec.getNames();
    for (const name of names) {
      const subcodec = subcodecs[i];
      const startIndex = indexStart + i;
      const header: GridHeader = {
        id: name,
        parent,
        name: name,
        key: i,
        multi: false,
        codec: subcodec,
        typename: getTypename(subcodec),
        depth,
        startIndex,
        span: 1,
        subHeaders: null,
      };
      headers.push(header);
      i++;
    }
    return {headers, colCount: headers.length};
  }
  throw new Error(`unexpected codec kind: ${codec.getKind()}`);
}

function _flattenHeaders(headers: GridHeader[]): GridHeader[] {
  return headers.flatMap((header) => [
    header,
    ...(header.subHeaders ? _flattenHeaders(header.subHeaders) : []),
  ]);
}

function getTypename(codec: ICodec): string {
  const kind = codec.getKind();
  switch (kind) {
    case "scalar":
    case "object":
    case "sparse_object":
    case "record":
      return codec.getKnownTypeName();
    case "array":
    case "range":
    case "multirange":
      return `${kind}<${getTypename(codec.getSubcodecs()[0])}>`;
    case "tuple":
      return `tuple<${codec
        .getSubcodecs()
        .map((subcodec) => getTypename(subcodec))
        .join(", ")}>`;
    case "namedtuple":
      const subcodecs = codec.getSubcodecs();
      return `tuple<${(codec as NamedTupleCodec)
        .getNames()
        .map((name, i) => `${name}: ${getTypename(subcodecs[i])}`)
        .join(", ")}>`;
    case "set":
      return getTypename(codec.getSubcodecs()[0]);
    default:
      assertNever(kind);
  }
}
