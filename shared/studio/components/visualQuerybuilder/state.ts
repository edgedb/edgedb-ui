import {computed} from "mobx";
import {
  model,
  Model,
  modelAction,
  objectMap,
  ObjectMap,
  prop,
} from "mobx-keystone";

export interface OrderByExpr {
  expr: string;
  dir?: "asc" | "desc";
  empty?: "first" | "last";
}

export interface FilterExpr {
  type: string;
  left: string;
  op: string;
  right: string;
}

export interface ObjectQuery {
  typename: string | null;
  props: ObjectMap<string | null>;
  links: ObjectMap<ObjectQuery>;
  filter?: FilterExpr;
  orderBy: OrderByExpr[];
  offset?: number;
  limit?: number;
}

export interface RootObjectQuery extends ObjectQuery {
  typename: string;
}

export function createRootObjectQuery(typename: string): RootObjectQuery {
  return {
    typename,
    props: objectMap(),
    links: objectMap(),
    orderBy: [],
  };
}

@model("QueryBuilder")
export class QuerybuilderState extends Model({
  root: prop<RootObjectQuery>().withSetter(),
}) {
  @modelAction
  toggleProp(
    query: ObjectQuery,
    propName: string,
    active: boolean,
    polyType?: string
  ) {
    if (active) {
      query.props.set(propName, polyType ?? null);
    } else {
      query.props.delete(propName);
    }
  }

  @modelAction
  toggleLink(
    query: ObjectQuery,
    linkName: string,
    active: boolean,
    polyType?: string
  ) {
    if (active) {
      query.links.set(linkName, {
        typename: polyType ?? null,
        props: objectMap(),
        links: objectMap(),
        orderBy: [],
      });
    } else {
      query.links.delete(linkName);
    }
  }

  @modelAction
  setFilter(query: ObjectQuery, type: string, left: string) {
    if (left) {
      query.filter = {type, left, op: "=", right: ""};
    } else {
      query.filter = undefined;
    }
  }

  @modelAction
  updateFilter(filter: FilterExpr, update: {op?: string; right?: string}) {
    filter.op = update.op ?? filter.op;
    filter.right = update.right ?? filter.right;
  }

  @modelAction
  setOrderBy(
    query: ObjectQuery,
    orderExpr: OrderByExpr | undefined,
    expr: string
  ) {
    if (orderExpr) {
      if (expr) {
        orderExpr.expr = expr;
      } else {
        query.orderBy = query.orderBy.filter((o) => o !== orderExpr);
      }
    } else if (expr) {
      query.orderBy.push({expr});
    }
  }

  @modelAction
  updateOrderBy(
    orderExpr: OrderByExpr,
    update: {dir?: "asc" | "desc"; empty?: "first" | "last"}
  ) {
    orderExpr.dir = update.dir ?? orderExpr.dir;
    orderExpr.empty = update.empty ?? orderExpr.empty;
  }

  @modelAction
  setOffset(query: ObjectQuery, val: string) {
    const int = parseInt(val, 10);
    query.offset = Number.isNaN(int) ? undefined : int;
  }

  @modelAction
  setLimit(query: ObjectQuery, val: string) {
    const int = parseInt(val, 10);
    query.limit = Number.isNaN(int) ? undefined : int;
  }

  @computed
  get query() {
    return `select ${this.root.typename} ${renderQuery(this.root, "")}`;
  }
}

function renderQuery(query: ObjectQuery, indent: string): string {
  return `{\n${indent + "  "}${[
    ...[...query.props].map(([name, type]) =>
      type ? `[is ${type}].${name}` : name
    ),
    ...[...query.links].map(
      ([name, subQuery]) =>
        `${
          subQuery.typename ? `[is ${subQuery.typename}].` : ""
        }${name}: ${renderQuery(subQuery, indent + "  ")}`
    ),
  ].join(`,\n  ${indent}`)}\n${indent}}${
    query.filter
      ? `\n${indent}filter ${query.filter.left} ${query.filter.op} ${
          query.filter.type !== "std::str" ? `<${query.filter.type}>` : ""
        }${JSON.stringify(query.filter.right)}`
      : ""
  }${
    query.orderBy.length
      ? `\n${indent}order by ${query.orderBy
          .map(
            (orderExpr) =>
              `${orderExpr.expr}${orderExpr.dir ? " " + orderExpr.dir : ""}${
                orderExpr.empty ? " empty " + orderExpr.empty : ""
              }`
          )
          .join(`\n${indent}  then `)}`
      : ""
  }${query.offset != null ? `\n${indent}offset ${query.offset}` : ""}${
    query.limit != null ? `\n${indent}limit ${query.limit}` : ""
  }`;
}
