import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {observer} from "mobx-react-lite";
import {VariableSizeList as List, ListChildComponentProps} from "react-window";

import cn from "@edgedb/common/utils/classNames";
import {useResize} from "@edgedb/common/hooks/useResize";
import {useInitialValue} from "@edgedb/common/hooks/useInitialValue";
import {Select} from "@edgedb/common/ui/select";

import {useDatabaseState, useTabState} from "../../state";

import styles from "./textView.module.scss";

import {SearchIcon} from "../../icons";

import {
  ModuleGroup,
  TypeFilter,
  SchemaTextView as SchemaTextState,
  SchemaItem,
} from "./state/textView";
import {Schema} from "./state";
import {renderers} from "./renderers";
import {ModuleHeaders} from "./renderers/module";

const schemaModuleGroups = Object.values(ModuleGroup).filter(
  (v) => typeof v === "number"
) as ModuleGroup[];

const typeFilters = Object.values(TypeFilter).filter(
  (v) => typeof v === "number"
) as TypeFilter[];

export const SchemaTextView = observer(function SchemaTextView() {
  const schemaTextState = useTabState(Schema).textViewState;

  const filtersRef = useRef<HTMLDivElement>(null);
  const [narrowLayout, setNarrowLayout] = useState(true);

  // useResize(
  //   filtersRef,
  //   (rect) => {
  //     const narrow = rect.width < 650;
  //     if (narrowLayout !== narrow) {
  //       setNarrowLayout(narrow);
  //     }
  //   },
  //   [narrowLayout]
  // );

  return (
    <div className={styles.schemaTextView}>
      <div ref={filtersRef} className={styles.filterControls}>
        <div className={styles.searchRow}>
          <div className={styles.filterSelect}>
            <div className={styles.filterSelectName}>Schema</div>
            <Select
              className={styles.moduleSelect}
              items={schemaModuleGroups.map((group) => ({
                label: (
                  <span className={styles.selectItem}>
                    {ModuleGroup[group]}
                  </span>
                ),
                action: () => {
                  schemaTextState.setSelectedModuleGroup(group);
                },
              }))}
              selectedItemIndex={schemaModuleGroups.indexOf(
                schemaTextState.selectedModuleGroup
              )}
            />
          </div>

          {narrowLayout ? (
            <div className={styles.filterSelect}>
              <div className={styles.filterSelectName}>Types</div>
              <Select
                className={styles.typeFilterSelect}
                items={[
                  {
                    label: "Everything",
                    action: () => schemaTextState.setSelectedTypeFilter(null),
                  },
                  ...typeFilters.map((typeFilter) => ({
                    label: TypeFilter[typeFilter],
                    action: () => {
                      schemaTextState.setSelectedTypeFilter(typeFilter);
                    },
                  })),
                ]}
                selectedItemIndex={
                  schemaTextState.selectedTypeFilter !== null
                    ? typeFilters.indexOf(schemaTextState.selectedTypeFilter) +
                      1
                    : 0
                }
              />
            </div>
          ) : null}
          <div className={styles.search}>
            <SearchIcon />
            <input
              placeholder="search..."
              value={schemaTextState.searchText}
              onChange={(e) => schemaTextState.setSearchText(e.target.value)}
            />
          </div>
        </div>
        {!narrowLayout ? (
          <div className={styles.typeFilters}>
            <div
              className={cn(styles.typeFilter, {
                [styles.active]: schemaTextState.selectedTypeFilter === null,
              })}
              onClick={() => schemaTextState.setSelectedTypeFilter(null)}
            >
              All
            </div>
            <div className={styles.separator} />
            {typeFilters.map((typeFilter) => (
              <div
                key={typeFilter}
                className={cn(styles.typeFilter, {
                  [styles.empty]:
                    schemaTextState.filteredItems[typeFilter].length === 0,
                  [styles.active]:
                    schemaTextState.selectedTypeFilter === typeFilter,
                })}
                onClick={() =>
                  schemaTextState.setSelectedTypeFilter(typeFilter)
                }
              >
                {TypeFilter[typeFilter]} ·{" "}
                {schemaTextState.filteredItems[typeFilter].length}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <SchemaTypesList />
    </div>
  );
});

const SchemaTextStateContext = createContext<SchemaTextState>(null!);

export function useSchemaTextState() {
  return useContext(SchemaTextStateContext);
}

const ListItemRenderer = observer(function ListItemRenderer({
  index,
  style,
}: ListChildComponentProps) {
  const state = useSchemaTextState();

  const resizeRef = useRef<HTMLDivElement>(null);

  const {item, matches} = state.renderListItems[index];
  const TypeRenderer = renderers[item.schemaType] as any;

  useResize(resizeRef, ({height}) => {
    if (height && item.schemaType !== "Module") {
      state.setRenderHeight(index, item, height);
    }
  });

  return (
    <div style={{position: "relative", height: "0px", top: style.top}}>
      <div
        className={cn(styles.listItem, {
          [styles.highlightedItem]: state.highlightedItem === item,
        })}
        ref={resizeRef}
      >
        <TypeRenderer type={item} matches={matches} />
      </div>
    </div>
  );
});

const innerElementType = forwardRef<HTMLDivElement>(
  ({children, ...props}: any, ref) => (
    <div
      ref={ref}
      {...props}
      style={{...props.style, minWidth: "100%", width: "max-content"}}
    >
      {children}
      <ModuleHeaders _rerender={props.style.height} />
    </div>
  )
);

const SchemaTypesList = observer(function SchemaTypesList() {
  const state = useTabState(Schema).textViewState;

  console.log("rerender");

  const listItems = state.renderListItems;

  const [containerHeight, setContainerHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useResize(containerRef, ({height}) => setContainerHeight(height));

  const initialScrollOffset = useInitialValue(() => state.scrollPos);

  const listRef = useRef<List>(null);

  useEffect(() => {
    state.listRef = listRef.current;
  }, [listRef]);

  useLayoutEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [listItems]);

  return (
    <SchemaTextStateContext.Provider value={state}>
      <div
        ref={containerRef}
        className={cn(styles.typesList, {
          [styles.searchMode]: state.searchText !== "",
        })}
      >
        <List
          ref={listRef}
          innerElementType={innerElementType}
          width={"100%"}
          height={containerHeight}
          initialScrollOffset={initialScrollOffset}
          onScroll={({scrollOffset}) => (state.scrollPos = scrollOffset)}
          itemCount={listItems.length}
          itemKey={(index) => {
            const item = listItems[index].item;
            return item.schemaType === "Module"
              ? `${item.module}-${item.isEnd}`
              : item.id;
          }}
          itemSize={(index) => {
            const item = listItems[index].item;
            return item.schemaType === "Module"
              ? 42
              : state.renderHeights.get(item.id) ?? 42;
          }}
        >
          {ListItemRenderer}
        </List>
      </div>
    </SchemaTextStateContext.Provider>
  );
});
