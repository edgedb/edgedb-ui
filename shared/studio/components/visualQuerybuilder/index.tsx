import {observer} from "mobx-react";
import cn from "@edgedb/common/utils/classNames";
import {useDatabaseState, useTabState} from "../../state";
import {SchemaData} from "../../state/database";
import {QueryEditor} from "../../tabs/queryEditor/state";
import {
  QueryBuilderShape,
  FilterExpr,
  FilterGroup,
  OrderByExpr,
  prefixOperators,
  QueryBuilderState,
} from "./state";
import {SchemaObjectType, SchemaProperty} from "@edgedb/common/schemaData";

import styles from "./querybuilder.module.scss";
import {Select} from "@edgedb/common/ui/select";
import {DeleteIcon} from "../../icons";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";
import Button from "@edgedb/common/ui/button";

export const VisualQuerybuilder = observer(function VisualQuerybuilder({
  state,
}: {
  state: QueryBuilderState;
}) {
  const schemaData = useDatabaseState().schemaData;

  if (!schemaData) {
    return <div>loading schema...</div>;
  }

  if (state.root.typename === null) {
    state.setRoot(
      new QueryBuilderShape({
        typename: [...schemaData.objects.values()].find(
          (type) => !type.builtin
        )!.name,
      })
    );
  }

  return <QuerybuilderRoot schemaData={schemaData} state={state} />;
});

const QuerybuilderRoot = observer(function QuerybuilderRoot({
  schemaData,
  state,
}: {
  schemaData: SchemaData;
  state: QueryBuilderState;
}) {
  const editorState = useTabState(QueryEditor);

  const schemaObjectTypes = [...schemaData.objects.values()].filter(
    (type) => !type.builtin
  );

  return (
    <>
      <CustomScrollbars
        className={styles.scrollWrapper}
        innerClass={styles.scrollInner}
      >
        <div
          className={cn(styles.queryBuilder, {
            [styles.editingDisabled]: editorState.showHistory,
          })}
        >
          <div className={styles.scrollInner}>
            <div className={styles.shapeBlock}>
              <div className={styles.row}>
                <span className={styles.keyword}>select</span>{" "}
                <Select
                  items={schemaObjectTypes.map((type) => ({
                    label: type.name,
                    action: () =>
                      state.setRoot(
                        new QueryBuilderShape({typename: type.name})
                      ),
                  }))}
                  selectedItemIndex={schemaObjectTypes.findIndex(
                    (type) => type.name === state.root.typename
                  )}
                />{" "}
                {"{"}
              </div>
              <QueryBuilderShapeRenderer
                shape={state.root}
                schemaType={
                  schemaData.objectsByName.get(state.root.typename!)!
                }
              />
            </div>
          </div>
        </div>
      </CustomScrollbars>

      {editorState.showHistory ? null : (
        <div className={styles.controls}>
          <Button
            className={styles.runButton}
            label="Run"
            disabled={!editorState.canRunQuery}
            loading={editorState.queryRunning}
            onClick={() => editorState.runQuery()}
          />
        </div>
      )}
    </>
  );
});

const QueryBuilderShapeRenderer = observer(
  function _QueryBuilderShapeRenderer({
    shape,
    schemaType,
    linkProps,
  }: {
    shape: QueryBuilderShape;
    schemaType: SchemaObjectType;
    linkProps?: {
      [name: string]: SchemaProperty;
    };
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
          `${p.source !== schemaType ? `[is ${p.source!.name}]` : ""}.${
            p.name
          }`
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
                  key={name}
                  className={cn(styles.row, {
                    [styles.inactive]: !shape.props.has(`@${name}`),
                  })}
                >
                  <label>
                    <input
                      type="checkbox"
                      className={cn(styles.checkbox, {
                        [styles.checked]: shape.props.has(`@${name}`),
                      })}
                      checked={shape.props.has(`@${name}`)}
                      onChange={(e) =>
                        shape.toggleProp(`@${name}`, e.target.checked)
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
              <div className={styles.row} key={pointer.name}>
                {pointer.type === "Property" ? (
                  <label
                    className={cn({
                      [styles.inactive]: !shape.props.has(pointer.name),
                    })}
                  >
                    <input
                      type="checkbox"
                      className={cn(styles.checkbox, {
                        [styles.checked]: shape.props.has(pointer.name),
                      })}
                      checked={shape.props.has(pointer.name)}
                      onChange={(e) =>
                        shape.toggleProp(
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
                  <div className={styles.shapeBlock}>
                    <div
                      className={cn(styles.row, {
                        [styles.inactive]: !shape.links.has(pointer.name),
                      })}
                    >
                      <label>
                        <input
                          type="checkbox"
                          className={cn(styles.checkbox, {
                            [styles.checked]: shape.links.has(pointer.name),
                          })}
                          checked={shape.links.has(pointer.name)}
                          onChange={(e) =>
                            shape.toggleLink(
                              pointer.name,
                              e.target.checked,
                              descType?.name
                            )
                          }
                        />
                        {descType ? `[is ${descType.name}].` : null}
                        {pointer.name}
                      </label>
                      {shape.links.has(pointer.name) ? ": {" : null}
                    </div>
                    {shape.links.has(pointer.name) ? (
                      <QueryBuilderShapeRenderer
                        shape={shape.links.get(pointer.name)!}
                        schemaType={pointer.target!}
                        linkProps={pointer.properties}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className={styles.row}>
          {"}"}
          <div className={styles.addModifiers}>
            {!shape.filter.exprs.length ? (
              <div
                className={styles.modButton}
                onClick={() => shape.filter.addExpr()}
              >
                filter
              </div>
            ) : null}
            {!shape.orderBy.length ? (
              <div
                className={styles.modButton}
                onClick={() => shape.setOrderBy(undefined, ".id")}
              >
                order by
              </div>
            ) : null}
            {shape.offset === null ? (
              <div
                className={styles.modButton}
                onClick={() => shape.setOffset("")}
              >
                offset
              </div>
            ) : null}
            {shape.limit === null ? (
              <div
                className={styles.modButton}
                onClick={() => shape.setLimit("")}
              >
                limit
              </div>
            ) : null}
          </div>
        </div>
        {shape.filter.exprs.length ? (
          <FilterGroupRenderer group={shape.filter} props={props} depth={0} />
        ) : null}
        {shape.orderBy.length ? (
          <div className={styles.orderByBlock}>
            {shape.orderBy.map((expr, i) => (
              <div
                className={cn(styles.modRow, {
                  [styles.indent]: i !== 0,
                })}
                key={`orderBy${i}`}
              >
                <span className={styles.keyword}>
                  {i === 0 ? "order by" : "then"}
                </span>{" "}
                <OrderBy
                  shape={shape}
                  expr={expr}
                  propNames={Object.keys(props)}
                />
                <RemoveButton onClick={() => shape.setOrderBy(expr, null)} />
              </div>
            ))}
            <div className={cn(styles.modRow, styles.indent)}>
              <div
                className={styles.modButton}
                onClick={() => shape.setOrderBy(undefined, ".id")}
              >
                then
              </div>
            </div>
          </div>
        ) : null}
        {shape.offset !== null ? (
          <div className={styles.modRow}>
            <span className={styles.keyword}>offset</span>
            <input
              className={cn({[styles.error]: shape.offset === ""})}
              value={shape.offset}
              onChange={(e) => shape.setOffset(e.target.value)}
            />
            <RemoveButton onClick={() => shape.setOffset(null)} />
          </div>
        ) : null}
        {shape.limit !== null ? (
          <div className={styles.modRow}>
            <span className={styles.keyword}>limit</span>
            <input
              className={cn({[styles.error]: shape.limit === ""})}
              value={shape.limit}
              onChange={(e) => shape.setLimit(e.target.value)}
            />
            <RemoveButton onClick={() => shape.setLimit(null)} />
          </div>
        ) : null}
      </>
    );
  }
);

const FilterGroupRenderer = observer(function _FilterGroupRenderer({
  group,
  props,
  depth,
}: {
  group: FilterGroup;
  props: {[name: string]: SchemaProperty};
  depth: number;
}) {
  return (
    <div
      className={cn(styles.filterGroup, {
        [styles.nested]: depth > 0,
        [styles.altBg]: depth % 2 === 0,
      })}
    >
      {group.exprs.map((expr, i) => (
        <div className={cn(styles.modRow, {[styles.indent]: i !== 0})}>
          {i === 0 ? (
            depth === 0 ? (
              <>
                <span className={styles.keyword}>filter</span>{" "}
              </>
            ) : null
          ) : (
            <>
              <div
                className={styles.keyword}
                onClick={i === 1 ? () => group.toggleKind() : undefined}
              >
                {group.kind}
              </div>{" "}
            </>
          )}
          {expr instanceof FilterExpr ? (
            <FilterExprRenderer key={i} expr={expr} props={props} />
          ) : (
            <FilterGroupRenderer
              key={i}
              group={expr}
              props={props}
              depth={depth + 1}
            />
          )}
          {depth === 0 || group.exprs.length > 2 ? (
            <RemoveButton onClick={() => group.removeAtIndex(i)} />
          ) : null}
        </div>
      ))}
      <div className={cn(styles.modRow, styles.indent)}>
        <div className={styles.modButton} onClick={() => group.addExpr()}>
          filter
        </div>
        <div className={styles.modButton} onClick={() => group.addGroup()}>
          (...)
        </div>
      </div>
    </div>
  );
});

const FilterExprRenderer = observer(function _FilterExprRenderer({
  expr,
  props,
}: {
  expr: FilterExpr;
  props: {[name: string]: SchemaProperty};
}) {
  const propNames = Object.keys(props);

  return (
    <div className={styles.filterExpr}>
      <Select
        className={styles.select}
        items={[
          ...Object.entries(props).map(([name, prop]) => ({
            label: name,
            action: () => expr.updateProp(name, prop.target!.name, true),
          })),
          ...prefixOperators.map(({op}) => ({
            label: <span className={styles.keyword}>{op}</span>,
            action: () => expr.updateOp(op),
          })),
        ]}
        selectedItemIndex={
          expr.isInfixOp
            ? propNames.indexOf(expr.prop)
            : prefixOperators.findIndex((op) => expr.op === op.op) +
              propNames.length
        }
      />
      {expr.isInfixOp ? (
        <>
          <Select
            className={styles.select}
            items={expr.infixOps.map((op) => ({
              label: op,
              action: () => expr.updateOp(op),
            }))}
            selectedItemIndex={expr.infixOps.indexOf(expr.op)}
          />
          {expr.propType !== "std::str" ? (
            <span className={styles.propType}>{`<${expr.propType}>`}</span>
          ) : null}
          <input
            className={cn({[styles.error]: expr.errMessage !== null})}
            value={expr.val}
            onChange={(e) => expr.setVal(e.target.value)}
          />
        </>
      ) : (
        <Select
          className={styles.select}
          items={Object.entries(props).map(([name, prop]) => ({
            label: name,
            action: () => expr.updateProp(name, prop.target!.name),
          }))}
          selectedItemIndex={propNames.indexOf(expr.prop)}
        />
      )}
    </div>
  );
});

const OrderBy = observer(function OrderBy({
  shape,
  expr,
  propNames,
}: {
  shape: QueryBuilderShape;
  expr: OrderByExpr;
  propNames: string[];
}) {
  return (
    <>
      <Select
        items={propNames.map((name) => ({
          label: name,
          action: () => shape.setOrderBy(expr, name),
        }))}
        selectedItemIndex={propNames.indexOf(expr.expr)}
      />
      <Select
        items={[
          {
            label: <span className={styles.keyword}>asc</span>,
            action: () => shape.updateOrderBy(expr, {dir: "asc"}),
          },
          {
            label: <span className={styles.keyword}>desc</span>,
            action: () => shape.updateOrderBy(expr, {dir: "desc"}),
          },
        ]}
        selectedItemIndex={expr.dir === "desc" ? 1 : 0}
      />
      <Select
        items={[
          {
            label: <span className={styles.keyword}>empty first</span>,
            action: () => shape.updateOrderBy(expr, {empty: "first"}),
          },
          {
            label: <span className={styles.keyword}>empty last</span>,
            action: () => shape.updateOrderBy(expr, {empty: "last"}),
          },
        ]}
        selectedItemIndex={
          expr.empty
            ? expr.empty === "first"
              ? 0
              : 1
            : expr.dir === "desc"
            ? 1
            : 0
        }
      />
    </>
  );
});

function RemoveButton({onClick}: {onClick: () => void}) {
  return (
    <div className={styles.removeButton} onClick={onClick}>
      <DeleteIcon />
    </div>
  );
}
