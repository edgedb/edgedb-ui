import {observer} from "mobx-react";
import {useState} from "react";
import {Text} from "@codemirror/state";
import cn from "@edgedb/common/utils/classNames";
import {useDatabaseState, useTabState} from "../../state";
import {SchemaData} from "../../state/database";
import {Repl} from "../../tabs/repl/state";
import {
  createRootObjectQuery,
  ObjectQuery,
  OrderByExpr,
  QuerybuilderState,
} from "./state";
import {SchemaObjectType, SchemaProperty} from "@edgedb/common/schemaData";

import styles from "./querybuilder.module.scss";

export const VisualQuerybuilder = observer(function VisualQuerybuilder() {
  const schemaData = useDatabaseState().schemaData;

  if (!schemaData) {
    return <div>loading...</div>;
  }

  return <QuerybuilderRoot schemaData={schemaData} />;
});

const QuerybuilderRoot = observer(function QuerybuilderRoot({
  schemaData,
}: {
  schemaData: SchemaData;
}) {
  const replState = useTabState(Repl);

  const schemaObjectTypes = [...schemaData.objects.values()].filter(
    (type) => !type.builtin
  );

  const [state] = useState(
    () =>
      new QuerybuilderState({
        root: createRootObjectQuery(schemaObjectTypes[0].name),
      })
  );
  const [debugQuery, setDebugQuery] = useState(false);

  return (
    <div className={styles.queryBuilder}>
      <div>
        select{" "}
        <select
          value={state.root.typename}
          onChange={(e) =>
            state.setRoot(createRootObjectQuery(e.target.value))
          }
        >
          {schemaObjectTypes.map((type) => (
            <option value={type.name}>{type.name}</option>
          ))}
        </select>{" "}
        {"{"}
      </div>
      <QueryBuilderObject
        state={state}
        schemaType={schemaData.objectsByName.get(state.root.typename)!}
        query={state.root}
      />
      <button
        onClick={() => {
          replState.setCurrentQuery(Text.of(state.query.split("\n")));
          replState.runQuery();
        }}
      >
        Run
      </button>

      <button
        style={{display: "block", marginTop: 20}}
        onClick={() => setDebugQuery(!debugQuery)}
      >
        debug query
      </button>
      {debugQuery ? <pre>{state.query}</pre> : null}
    </div>
  );
});

const QueryBuilderObject = observer(function _QueryBuilderObject({
  state,
  schemaType,
  linkProps,
  query,
}: {
  state: QuerybuilderState;
  schemaType: SchemaObjectType;
  linkProps?: {
    [name: string]: SchemaProperty;
  };
  query: ObjectQuery;
}) {
  const pointers = [
    ...schemaType.pointers,
    ...schemaType.descendents.flatMap((desc) =>
      desc.pointers.filter((p) => p["@owned"])
    ),
  ];
  const props = pointers.reduce((props, p) => {
    if (p.type === "Property") {
      props[
        `${p.source !== schemaType ? `[is ${p.source!.name}]` : ""}.${p.name}`
      ] = p;
    }
    return props;
  }, {} as {[name: string]: SchemaProperty});

  return (
    <>
      <div style={{paddingLeft: 20}}>
        {linkProps
          ? Object.keys(linkProps).map((name) => (
              <div
                className={cn({
                  [styles.inactive]: !query.props.has(`@${name}`),
                })}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={query.props.has(`@${name}`)}
                    onChange={(e) =>
                      state.toggleProp(query, `@${name}`, e.target.checked)
                    }
                  />
                  @{name}
                </label>
              </div>
            ))
          : null}

        {pointers.map((pointer) => {
          const descType =
            pointer.source !== schemaType ? pointer.source : null;

          return (
            <div>
              {pointer.type === "Property" ? (
                <label
                  className={cn({
                    [styles.inactive]: !query.props.has(pointer.name),
                  })}
                >
                  <input
                    type="checkbox"
                    checked={query.props.has(pointer.name)}
                    onChange={(e) =>
                      state.toggleProp(
                        query,
                        pointer.name,
                        e.target.checked,
                        descType?.name
                      )
                    }
                  />
                  {descType ? `[is ${descType.name}].` : null}
                  {pointer.name}
                </label>
              ) : (
                <>
                  <div
                    className={cn({
                      [styles.inactive]: !query.links.has(pointer.name),
                    })}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={query.links.has(pointer.name)}
                        onChange={(e) =>
                          state.toggleLink(
                            query,
                            pointer.name,
                            e.target.checked,
                            descType?.name
                          )
                        }
                      />
                      {descType ? `[is ${descType.name}].` : null}
                      {pointer.name}
                    </label>
                    {query.links.has(pointer.name) ? ": {" : null}
                  </div>
                  {query.links.has(pointer.name) ? (
                    <QueryBuilderObject
                      state={state}
                      schemaType={pointer.target!}
                      linkProps={pointer.properties}
                      query={query.links.get(pointer.name)!}
                    />
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div>
        {"}"}
        <span
          className={cn({
            [styles.inactive]: !query.filter,
          })}
        >
          {" "}
          filter{" "}
          <select
            value={query.filter?.left ?? ""}
            onChange={(e) =>
              state.setFilter(
                query,
                props[e.target.value]?.target!.name,
                e.target.value
              )
            }
          >
            <option value=""></option>
            {Object.keys(props).map((name) => (
              <option value={name}>{name}</option>
            ))}
          </select>
          {query.filter ? (
            <>
              <select
                value={query.filter.op}
                onChange={(e) =>
                  state.updateFilter(query.filter!, {op: e.target.value})
                }
              >
                {[
                  "=",
                  "!=",
                  "?=",
                  "?!=",
                  "<",
                  ">",
                  "<=",
                  ">=",
                  ...(query.filter.type === "std::str"
                    ? ["like", "ilike"]
                    : []),
                ].map((op) => (
                  <option value={op}>{op}</option>
                ))}
              </select>
              <input
                value={query.filter.right}
                onChange={(e) =>
                  state.updateFilter(query.filter!, {right: e.target.value})
                }
              />
            </>
          ) : null}
        </span>
      </div>
      <div
        style={{marginLeft: "2ch"}}
        className={cn({
          [styles.inactive]: !query.orderBy.length,
        })}
      >
        order by{" "}
        <OrderBy
          state={state}
          query={query}
          expr={query.orderBy[0]}
          props={props}
        />
        {query.orderBy.length
          ? [...query.orderBy.slice(1), undefined].map((expr) => (
              <div
                style={{marginLeft: "1ch"}}
                className={cn({
                  [styles.inactive]: !expr,
                })}
              >
                then{" "}
                <OrderBy
                  state={state}
                  query={query}
                  expr={expr}
                  props={props}
                />
              </div>
            ))
          : null}
      </div>
      <div
        style={{marginLeft: "2ch"}}
        className={cn({
          [styles.inactive]: query.offset == null,
        })}
      >
        offset{" "}
        <input
          value={query.offset ?? ""}
          onChange={(e) => state.setOffset(query, e.target.value)}
        />
      </div>
      <div
        style={{marginLeft: "2ch"}}
        className={cn({
          [styles.inactive]: query.limit == null,
        })}
      >
        limit{" "}
        <input
          value={query.limit ?? ""}
          onChange={(e) => state.setLimit(query, e.target.value)}
        />
      </div>
    </>
  );
});

const OrderBy = observer(function OrderBy({
  state,
  query,
  expr,
  props,
}: {
  state: QuerybuilderState;
  query: ObjectQuery;
  expr?: OrderByExpr;
  props: {[name: string]: SchemaProperty};
}) {
  return (
    <>
      <select
        value={expr?.expr ?? ""}
        onChange={(e) => state.setOrderBy(query, expr, e.target.value)}
      >
        <option value=""></option>
        {Object.keys(props).map((name) => (
          <option value={name}>{name}</option>
        ))}
      </select>
      {expr ? (
        <>
          <select
            value={expr.dir ?? "asc"}
            onChange={(e) =>
              state.updateOrderBy(expr, {
                dir: e.target.value as any,
              })
            }
          >
            <option value="asc">asc</option>
            <option value="desc">desc</option>
          </select>
          <select
            value={expr.empty ?? (expr.dir === "desc" ? "last" : "first")}
            onChange={(e) =>
              state.updateOrderBy(expr, {
                empty: e.target.value as any,
              })
            }
          >
            <option value="first">empty first</option>
            <option value="last">empty last</option>
          </select>
        </>
      ) : null}
    </>
  );
});
