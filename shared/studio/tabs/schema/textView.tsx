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
import {
  useMatch,
  useLocation,
  useParams,
  useNavigate,
  useSearchParams,
  createSearchParams,
  Location,
} from "react-router-dom";

import cn from "@edgedb/common/utils/classNames";
import {useResize} from "@edgedb/common/hooks/useResize";
import {useInitialValue} from "@edgedb/common/hooks/useInitialValue";
import {Select} from "@edgedb/common/ui/select";

import {useDatabaseState, useTabState} from "../../state";

import styles from "./textView.module.scss";

import {CloseIcon, SearchIcon} from "../../icons";

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
const moduleGroupNames = new Set(
  schemaModuleGroups.map((mg) => ModuleGroup[mg])
);

const typeFilters = Object.values(TypeFilter).filter(
  (v) => typeof v === "number"
) as TypeFilter[];

const scrollOffsetCache = new Map<string, number>();

export const SchemaTextView = observer(function SchemaTextView() {
  const state = useTabState(Schema).textViewState;
  const location = useLocation();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedModuleGroup = params["*"]?.toLowerCase() ?? "";

  useLayoutEffect(() => {
    if (
      selectedModuleGroup !== "" &&
      (selectedModuleGroup === "user" ||
        !moduleGroupNames.has(selectedModuleGroup))
    ) {
      navigate("", {replace: true});
    } else {
      state.setSelectedModuleGroup(
        ModuleGroup[selectedModuleGroup || ("user" as any)] as any
      );
    }
  }, [selectedModuleGroup, navigate]);

  useLayoutEffect(() => {
    const typeFilter = searchParams.get("type");
    if (typeFilter !== state.selectedTypeFilter) {
      state.setSelectedTypeFilter(
        typeFilter ? (TypeFilter[typeFilter as any] as any) : null
      );
    }
    const search = searchParams.get("search");
    if (search !== state.searchText) {
      state.setSearchText(search ?? "");
    }
  }, [searchParams]);

  useLayoutEffect(() => {
    const scrollOffset = scrollOffsetCache.get(location.key);
    if (scrollOffset !== undefined) {
      state.listRef?.scrollTo(scrollOffset);
    }

    const focusedName = searchParams.get("focus");
    state.setHighlightedItem(focusedName ?? null);

    return () => {
      scrollOffsetCache.set(location.key, state.scrollPos);
    };
  }, [location]);

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
                  navigate(
                    group === ModuleGroup.user ? "" : ModuleGroup[group]
                  );
                },
              }))}
              selectedItemIndex={schemaModuleGroups.indexOf(
                state.selectedModuleGroup
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
                    action: () => {
                      const params = createSearchParams(searchParams);
                      params.delete("type");
                      setSearchParams(params);
                    },
                  },
                  ...typeFilters.map((typeFilter) => ({
                    label: TypeFilter[typeFilter],
                    action: () => {
                      const params = createSearchParams(searchParams);
                      params.set("type", TypeFilter[typeFilter]);
                      setSearchParams(params);
                    },
                  })),
                ]}
                selectedItemIndex={
                  state.selectedTypeFilter !== null
                    ? typeFilters.indexOf(state.selectedTypeFilter) + 1
                    : 0
                }
              />
            </div>
          ) : null}
          <div className={styles.search}>
            <SearchIcon />
            <input
              placeholder="search..."
              value={state.searchText}
              onChange={(e) => {
                const searchVal = e.target.value;
                state.setSearchText(searchVal);
                const params = createSearchParams(searchParams);
                if (searchVal) {
                  params.set("search", searchVal);
                } else {
                  params.delete("search");
                }
                setSearchParams(params, {
                  replace: !!searchParams.get("search") && !!searchVal,
                });
              }}
            />
            {searchParams.has("search") ? (
              <div
                className={styles.clearSearch}
                onClick={() => {
                  state.setSearchText("");
                  const params = createSearchParams(searchParams);
                  params.delete("search");
                  setSearchParams(params);
                }}
              >
                <CloseIcon />
              </div>
            ) : null}
          </div>
        </div>
        {!narrowLayout ? (
          <div className={styles.typeFilters}>
            <div
              className={cn(styles.typeFilter, {
                [styles.active]: state.selectedTypeFilter === null,
              })}
              onClick={() => state.setSelectedTypeFilter(null)}
            >
              All
            </div>
            <div className={styles.separator} />
            {typeFilters.map((typeFilter) => (
              <div
                key={typeFilter}
                className={cn(styles.typeFilter, {
                  [styles.empty]: state.filteredItems[typeFilter].length === 0,
                  [styles.active]: state.selectedTypeFilter === typeFilter,
                })}
                onClick={() => state.setSelectedTypeFilter(typeFilter)}
              >
                {TypeFilter[typeFilter]} ·{" "}
                {state.filteredItems[typeFilter].length}
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

  useResize(
    resizeRef,
    ({height}) => {
      if (height && item.schemaType !== "Module") {
        state.setRenderHeight(index, item, height);
      }
    },
    [item, index]
  );

  return (
    <div style={{position: "relative", height: "0px", top: style.top}}>
      <div
        className={cn(styles.listItem, {
          [styles.highlightedItem]:
            state.highlightedItem === (item as any).name,
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
