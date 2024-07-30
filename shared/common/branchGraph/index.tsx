import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {observable} from "mobx";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";
import {InstanceState} from "@edgedb/studio/state/instance";
import {currentTimestamp} from "@edgedb/common/utils/relativeTime";
import {CustomScrollbars} from "../ui/customScrollbar";
import CodeBlock from "@edgedb/common/ui/codeBlock";

import {
  ArrowRightIcon,
  CheckIcon,
  CrossIcon,
  SyncIcon,
  GithubLogo,
  GitCommitIcon,
  GitPullRequestIcon,
  MigrationsListIcon,
  ChevronDownIcon,
  WarningIcon,
} from "@edgedb/common/newui";
import {CopyButton} from "../newui/copyButton";
import {PopupArrow} from "../newui/icons/other";

import {
  GraphItem,
  LayoutNode,
  MigrationHistoryData,
  buildBranchGraph,
  fetchMigrationsData,
  findGraphItemBranch,
  getMigrationHistoryFromItem,
  joinGraphLayouts,
} from "./layout";

import styles from "./branchGraph.module.scss";
import Spinner from "../ui/spinner";
import {useResize} from "../hooks/useResize";

export interface BranchGraphGithubBranch {
  // branch_name: z.string(),
  // deleted: z.boolean(),
  status: "updating" | "error" | "up-to-date" | `unknown_${string}`;
  last_updated_at: Date | null;
  error_message: string | null;
  latest_commit_sha: string;
  db_branch_name: string | null;
  pr_issue_number: number | null;
  // created_on: zDate,
}

export interface BranchGraphGithubDetails {
  githubSlug: string;
  repoName: string;
  branches: BranchGraphGithubBranch[];
}

type BranchLink = (
  props: PropsWithChildren<{
    className?: string;
    branchName: string;
  }>
) => JSX.Element;

export interface BranchGraphProps {
  className?: string;
  instanceId?: string;
  instanceState: InstanceState | Error | null;
  BranchLink: BranchLink;
  githubDetails?: BranchGraphGithubDetails;
  BottomButton?: (props: {className?: string}) => JSX.Element;
  onPanelOpen?: () => void;
}

export const BranchGraphContext = createContext<{
  fetchMigrations: (graphItems: GraphItem[]) => Promise<string[]>;
}>(null!);

export const BranchGraph = observer(function BranchGraph({
  instanceId,
  instanceState,
  ...props
}: BranchGraphProps) {
  const [refreshing, setRefreshing] = useState(true);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[] | null>(null);

  useEffect(() => {
    if (
      !refreshing ||
      !instanceId ||
      !(instanceState instanceof InstanceState)
    ) {
      return;
    }
    fetchMigrationsData(instanceId, instanceState).then((data) => {
      if (!data) return;

      const layoutNodes = joinGraphLayouts(buildBranchGraph(data));
      setLayoutNodes(layoutNodes);
      setRefreshing(false);
    });
  }, [refreshing, instanceId, instanceState]);

  const fetchMigrations =
    instanceState instanceof Error
      ? () => {
          throw new Error(`Error connecting to instance`);
        }
      : async (graphItems: GraphItem[]) => {
          const conn = instanceState!.getConnection(
            findGraphItemBranch(graphItems[0])
          );
          const result = await conn.query(
            `select (
        select schema::Migration
        filter .name in array_unpack(<array<str>>$names)
      ).script`,
            {names: graphItems.map((item) => item.name)}
          );
          const scripts = result.result;
          if (scripts == null || scripts.length != graphItems.length) {
            throw new Error(
              `Migrations not found for ${graphItems
                .map((item) => item.name)
                .join(", ")}`
            );
          }
          return scripts as string[];
        };

  return (
    <BranchGraphContext.Provider
      value={{
        fetchMigrations,
      }}
    >
      <_BranchGraphRenderer
        layoutNodes={
          instanceState instanceof Error ? instanceState : layoutNodes
        }
        {...props}
        TopButton={({className}) => (
          <button
            className={cn(className, {
              [styles.refreshing]: refreshing,
            })}
            onClick={() => {
              localStorage.removeItem(`edgedb-branch-graph-${instanceId}`);
              setRefreshing(true);
            }}
          >
            <SyncIcon />
          </button>
        )}
      />
    </BranchGraphContext.Provider>
  );
});

type SetActivePopup = (el: HTMLElement, popup: JSX.Element) => void;
type GetMigrationIdRef = (
  node: LayoutNode
) => (el: HTMLElement | null) => void;
type SetActiveMigrationItem = (item: GraphItem) => void;

export function _BranchGraphRenderer({
  className,
  BranchLink,
  TopButton,
  BottomButton,
  layoutNodes,
  githubDetails,
  onPanelOpen,
}: Pick<
  BranchGraphProps,
  "className" | "BranchLink" | "BottomButton" | "githubDetails" | "onPanelOpen"
> & {
  layoutNodes: LayoutNode[] | null | Error;
  TopButton?: (props: {className?: string}) => JSX.Element;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const migrationIdRefs = useRef(new Map<GraphItem, HTMLElement>());
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeMigrationHistory, _setActiveMigrationHistory] =
    useState<MigrationHistoryData | null>(null);
  const [highlightedMigrationItem, setHighlightedMigrationItem] =
    useState<GraphItem | null>(null);

  const [activePopup, _setActivePopup] = useState<{
    pos: {top: number; left: number; width: number; height: number};
    el: JSX.Element;
  } | null>(null);

  useResize(ref, () => {
    _setActivePopup(null);
  });

  const setActivePopup = useCallback(
    (el: HTMLElement, popup: JSX.Element) => {
      const refRect = ref.current!.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      _setActivePopup({
        el: popup,
        pos: {
          top: elRect.top - refRect.top,
          left: elRect.left - refRect.left,
          width: elRect.width,
          height: elRect.height,
        },
      });
    },
    [_setActivePopup]
  );

  const getMigrationIdRef = useCallback(
    (node: LayoutNode) => (el: HTMLElement | null) => {
      if (el) {
        for (const item of node.items) {
          migrationIdRefs.current.set(item, el);
        }
      } else {
        for (const item of node.items) {
          migrationIdRefs.current.delete(item);
        }
      }
    },
    [migrationIdRefs.current]
  );

  useEffect(() => {
    if (activePopup && ref.current) {
      const scrollListener = () => {
        _setActivePopup(null);
      };

      ref.current.addEventListener("scroll", scrollListener);

      const clickListener = (e: MouseEvent) => {
        if (!popupRef.current?.contains(e.target as HTMLElement)) {
          _setActivePopup(null);
        }
      };
      window.addEventListener("mousedown", clickListener, {capture: true});

      return () => {
        ref.current?.removeEventListener("scroll", scrollListener);

        window.removeEventListener("mousedown", clickListener, {
          capture: true,
        });
      };
    }
  }, [activePopup]);

  const setActiveMigrationItem = useCallback(
    (item: GraphItem) => {
      _setActiveMigrationHistory(getMigrationHistoryFromItem(item));
      setHighlightedMigrationItem(item);

      if (!panelOpen) {
        onPanelOpen?.();
        setPanelOpen(true);
      }
    },
    [_setActiveMigrationHistory, panelOpen]
  );

  const setHighlightedMigrationItemAndCenter = useCallback(
    (item: GraphItem) => {
      setHighlightedMigrationItem(item);
      if (item) {
        const el = migrationIdRefs.current.get(item);
        if (el) {
          const itemRect = el.getBoundingClientRect();
          const graphRect = ref.current!.getBoundingClientRect();
          if (
            itemRect.right < graphRect.left + 64 ||
            itemRect.left > graphRect.right - 96 ||
            itemRect.top > graphRect.bottom - 64 ||
            itemRect.bottom < graphRect.top + 64
          ) {
            ref.current!.scrollTo({
              top:
                ref.current!.scrollTop +
                (itemRect.top -
                  (graphRect.top +
                    graphRect.height / 2 -
                    itemRect.height / 2)),
              left:
                ref.current!.scrollLeft +
                (itemRect.left -
                  (graphRect.left + graphRect.width / 2 - itemRect.width / 2)),
              behavior: "smooth",
            });
          }
        }
      }
    },
    [setHighlightedMigrationItem]
  );

  return (
    <div className={cn(styles.branchGraph, className)}>
      <CustomScrollbars
        className={styles.outerScrollContainer}
        innerClass={styles.nodeGrid}
      >
        <div ref={ref} className={cn(styles.scrollWrapper)}>
          <div className={styles.centerWrapper}>
            {layoutNodes instanceof Error ? (
              <div className={styles.error}>
                <WarningIcon />
                Error connecting to instance
              </div>
            ) : layoutNodes ? (
              <div className={styles.nodeGrid}>
                {layoutNodes.map((node) => (
                  <BranchGraphNode
                    key={
                      node.items[0].name
                        ? node.items[0].name + node.branchIndex
                        : node.items[0].branches![0]
                    }
                    node={node}
                    BranchLink={BranchLink}
                    githubDetails={githubDetails}
                    setActivePopup={setActivePopup}
                    activeMigrationItems={
                      activeMigrationHistory?.items ?? null
                    }
                    highlightedMigrationItem={highlightedMigrationItem}
                    setActiveMigrationItem={setActiveMigrationItem}
                    getMigrationIdRef={getMigrationIdRef}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.loading}>
                <Spinner size={20} />
              </div>
            )}
          </div>
        </div>

        {layoutNodes ? (
          <>
            {TopButton ? (
              <TopButton
                className={cn(styles.floatingButton, styles.topButton, {
                  [styles.panelOpen]: panelOpen,
                })}
              />
            ) : null}
            {BottomButton ? (
              <BottomButton
                className={cn(styles.floatingButton, styles.bottomButton)}
              />
            ) : null}

            {activePopup ? (
              <div
                ref={popupRef}
                className={styles.popupWrapper}
                style={activePopup.pos}
              >
                {activePopup.el}
              </div>
            ) : null}
          </>
        ) : null}
      </CustomScrollbars>
      <div
        className={cn(styles.migrationsPanelWrapper, {
          [styles.panelOpen]: panelOpen,
        })}
        onTransitionEnd={
          !panelOpen ? () => _setActiveMigrationHistory(null) : undefined
        }
      >
        {activeMigrationHistory ? (
          <>
            <MigrationsPanel
              key={activeMigrationHistory.items[0].name}
              history={activeMigrationHistory}
              setActiveMigrationItem={setActiveMigrationItem}
              highlightedMigrationItem={highlightedMigrationItem}
              setHighlightedMigrationItem={
                setHighlightedMigrationItemAndCenter
              }
            />
            <button
              className={cn(styles.floatingButton, styles.closePanelButton)}
              onClick={() => {
                setHighlightedMigrationItem(null);
                setPanelOpen(false);
              }}
            >
              <ChevronDownIcon />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function BranchGraphNode({
  node,
  BranchLink,
  githubDetails,
  setActivePopup,
  activeMigrationItems,
  highlightedMigrationItem,
  setActiveMigrationItem,
  getMigrationIdRef,
}: {
  node: LayoutNode;
  BranchLink: BranchLink;
  githubDetails?: BranchGraphGithubDetails;
  setActivePopup: SetActivePopup;
  activeMigrationItems: GraphItem[] | null;
  highlightedMigrationItem: GraphItem | null;
  setActiveMigrationItem: SetActiveMigrationItem;
  getMigrationIdRef: GetMigrationIdRef;
}) {
  const positionStyle = {
    gridColumn: node.col * 2 + 1,
    gridRow: node.row + 1,
  };
  const item = node.items[0];
  const fadedItem =
    activeMigrationItems != null && !activeMigrationItems.includes(item);

  let connector: JSX.Element | null = null;

  if (
    node.parentNode &&
    (node.branchIndex == null || node.branchIndex === 0)
  ) {
    const straightLine = node.parentNode.row === node.row;

    connector = (
      <div
        className={cn(
          styles.connector,
          straightLine ? styles.line : styles.curved,
          {[styles.faded]: fadedItem}
        )}
        style={{
          gridColumn: node.col * 2,
          gridRowStart: node.parentNode.row + 1,
          gridRowEnd: node.row + 1,
          zIndex: fadedItem ? undefined : 1,
        }}
      >
        {straightLine ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 31 31"
            preserveAspectRatio="none"
          >
            <path d="M 0 15.5 H 31" />
          </svg>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 31">
              <path d="M 0 15.5 a 16 16 0 0 1 15.5 15.5" />
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 31 31"
              preserveAspectRatio="none"
            >
              <path d="M 15.5 0 V 31" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 31">
              <path d="M 15.5 0 a 16 16 0 0 0 15.5 15.5" />
            </svg>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {connector}
      <div
        className={cn(styles.migrationNode, {
          [styles.faded]: fadedItem,
        })}
        style={positionStyle}
      >
        {node.branchIndex == null || node.branchIndex == 0 ? (
          <>
            <MigrationID
              node={node}
              isHighlighted={
                highlightedMigrationItem != null &&
                node.items.includes(highlightedMigrationItem)
              }
              setActiveMigration={setActiveMigrationItem}
              getMigrationIdRef={getMigrationIdRef}
            />
            {connector || item.children.length ? (
              <svg
                className={cn(styles.line, {
                  [styles.root]: !connector,
                  [styles.leaf]: !item.children.length,
                  [styles.multi]: node.items.length > 1,
                })}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 31 31"
                preserveAspectRatio="none"
              >
                <path d="M 0 15.5 H 31" />
              </svg>
            ) : null}
            {node.items.length > 1 ? (
              <svg
                className={styles.multidot}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 31 31"
              >
                <path d="M 10.5 10.5 H 20.5 A 5 5 0 0 1 20.5 20.5 H 10.5 A 5 5 0 0 1 10.5 10.5" />
              </svg>
            ) : (
              <svg
                className={styles.dot}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 31 31"
              >
                <circle cx="15.5" cy="15.5" r="5" />
              </svg>
            )}
          </>
        ) : null}

        {node.branchIndex != null ? (
          <BranchGraphButton
            branchName={item.branches![node.branchIndex]}
            BranchLink={BranchLink}
            githubDetails={githubDetails}
            setActivePopup={setActivePopup}
            branchLine={item.branches!.length > 1 ? node.branchIndex + 1 : 0}
          />
        ) : null}
      </div>
    </>
  );
}

function BranchGraphButton({
  branchName,
  setActivePopup,
  BranchLink,
  githubDetails,
  branchLine,
}: {
  branchName: string;
  BranchLink: BranchLink;
  setActivePopup: SetActivePopup;
  githubDetails?: BranchGraphGithubDetails;
  branchLine?: number;
}) {
  const githubBranch = githubDetails?.branches.find(
    (b) => b.db_branch_name === branchName
  );

  const statusIcon = githubBranch ? (
    githubBranch.status === "updating" ? (
      <SyncIcon />
    ) : githubBranch.status === "up-to-date" ? (
      <CheckIcon />
    ) : (
      <CrossIcon />
    )
  ) : null;

  return (
    <div
      className={cn(styles.branchButtonWrapper, {
        [styles.indented]: branchLine != null && branchLine > 0,
        [styles.firstBranch]: branchLine != null && branchLine <= 1,
      })}
    >
      {branchLine != null ? (
        <svg
          className={styles.branchLine}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 -${branchLine > 1 ? 56 : 20} 31 ${
            branchLine > 1 ? 87 : 51
          }`}
          style={
            branchLine > 1 ? {top: -51, height: 87} : {top: -11, height: 51}
          }
        >
          <path d="M 15.5 -56 L 15.5 0 a 16 16 0 0 0 15.5 15.5" />
        </svg>
      ) : null}
      <div className={styles.branchButton}>
        {githubBranch ? (
          <div
            className={styles.githubDetails}
            onClick={(e) =>
              setActivePopup(
                e.currentTarget,
                <GithubBranchPopup
                  githubSlug={githubDetails!.githubSlug}
                  repoName={githubDetails!.repoName}
                  githubBranch={githubBranch}
                />
              )
            }
          >
            <GithubLogo className={styles.githubIcon} />
            <div
              className={cn(styles.githubStatus, styles[githubBranch.status])}
            >
              {statusIcon}
              {statusIcon}
            </div>
          </div>
        ) : null}

        <BranchLink className={styles.branchLink} branchName={branchName}>
          <span>
            <bdo dir="ltr" title={branchName}>
              {branchName}
            </bdo>
          </span>
          <ArrowRightIcon />
        </BranchLink>
      </div>
    </div>
  );
}

function GithubBranchPopup({
  githubSlug,
  repoName,
  githubBranch: {status, latest_commit_sha, pr_issue_number, last_updated_at},
}: {
  githubSlug: string;
  repoName: string;
  githubBranch: BranchGraphGithubBranch;
}) {
  return (
    <div className={styles.githubBranchPopup}>
      <PopupArrow className={styles.arrow} />
      <span>
        {status === "up-to-date" ? (
          <>
            Last synced <RelativeTime time={last_updated_at!} /> from
          </>
        ) : status === "updating" ? (
          "Syncing from"
        ) : (
          <>
            Failed to sync <RelativeTime time={last_updated_at!} /> from
          </>
        )}
      </span>
      <a
        href={`https://github.com/${githubSlug}/${repoName}/commit/${latest_commit_sha}`}
        target="_blank"
      >
        <GitCommitIcon />
        {latest_commit_sha.slice(0, 8)}
      </a>
      {pr_issue_number ? (
        <a
          href={`https://github.com/${githubSlug}/${repoName}/pull/${pr_issue_number}`}
          target="_blank"
        >
          <GitPullRequestIcon />#{pr_issue_number}
        </a>
      ) : null}
    </div>
  );
}

function MigrationID({
  node,
  isHighlighted,
  setActiveMigration,
  getMigrationIdRef,
}: {
  node: LayoutNode;
  isHighlighted: boolean;
  setActiveMigration: SetActiveMigrationItem;
  getMigrationIdRef: GetMigrationIdRef;
}) {
  if (!node.items[0].name) {
    return <div className={cn(styles.migrationId, styles.empty)}>empty</div>;
  }

  return (
    <div
      ref={getMigrationIdRef(node)}
      className={cn(styles.migrationId, {
        [styles.multi]: node.items.length > 1,
        [styles.highlighted]: isHighlighted,
      })}
      onClick={() => setActiveMigration(node.items[node.items.length - 1])}
    >
      {node.items.length > 1
        ? `${node.items[0].name.slice(2, 10)} - ${node.items[
            node.items.length - 1
          ].name.slice(2, 10)}`
        : node.items[0].name.slice(2, 10)}
      <MigrationsListIcon />
    </div>
  );
}

const migrationScripts = observable(new Map<string, string>());

const MigrationsPanel = observer(function MigrationsPanel({
  history,
  setActiveMigrationItem,
  highlightedMigrationItem,
  setHighlightedMigrationItem,
}: {
  history: MigrationHistoryData;
  setActiveMigrationItem: SetActiveMigrationItem;
  highlightedMigrationItem: GraphItem | null;
  setHighlightedMigrationItem: (item: GraphItem) => void;
}) {
  const {fetchMigrations} = useContext(BranchGraphContext);
  const [fetching, setFetching] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const migrationRefs = useRef({
    items: new Map<GraphItem, HTMLDivElement>(),
    els: new Map<HTMLDivElement, GraphItem>(),
  });
  const intersectionObserver = useRef<IntersectionObserver | null>(null);
  const currentMigrationRef = useRef<GraphItem | null>(null);
  const scrollingTo = useRef<GraphItem | null>(null);

  const [panelHeight, _setPanelHeight] = useState(0);
  useResize(scrollRef, ({height}) => _setPanelHeight(height));

  useEffect(() => {
    if (fetching) return;

    const missingItems = history.items.filter(
      (item) => !migrationScripts.has(item.name)
    );
    if (missingItems.length) {
      setFetching(true);
      fetchMigrations(missingItems)
        .then((scripts) => {
          for (let i = 0; i < scripts.length; i++) {
            migrationScripts.set(missingItems[i].name, scripts[i]);
          }
        })
        .finally(() => setFetching(false));
    }
  }, [history, fetching]);

  useEffect(() => {
    const visibleItems = new Set<string>();

    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const item = migrationRefs.current.els.get(
            entry.target as HTMLDivElement
          );
          if (entry.isIntersecting) {
            visibleItems.add(item!.name);
          } else {
            visibleItems.delete(item!.name);
          }
        }

        for (const item of history.items) {
          if (visibleItems.has(item.name)) {
            if (scrollingTo.current == item) {
              scrollingTo.current = null;
            }
            if (
              scrollingTo.current == null &&
              currentMigrationRef.current &&
              currentMigrationRef.current != item
            ) {
              setHighlightedMigrationItem(item);
            }
            currentMigrationRef.current = item;
            break;
          }
        }
      },
      {root: scrollRef.current, rootMargin: "-48px 0px 0px 0px"}
    );

    for (const el of migrationRefs.current.items.values()) {
      intersectionObserver.current.observe(el);
    }

    return () => {
      intersectionObserver.current?.disconnect();
      intersectionObserver.current = null;
    };
  }, [history.items]);

  useEffect(() => {
    if (
      highlightedMigrationItem &&
      highlightedMigrationItem != currentMigrationRef.current
    ) {
      const el = migrationRefs.current.items.get(highlightedMigrationItem);
      if (el) {
        const rect = el.getBoundingClientRect();
        const scrollRect = scrollRef.current!.getBoundingClientRect();
        scrollingTo.current = highlightedMigrationItem;
        scrollRef.current!.scrollTo({
          top: scrollRef.current!.scrollTop + (rect.top - scrollRect.top),
          behavior: "smooth",
        });
      }
    }
  }, [highlightedMigrationItem]);

  const line = (
    <svg
      className={cn(styles.line)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 31 31"
      preserveAspectRatio="none"
    >
      <path d="M 15.5 0 V 31" />
    </svg>
  );

  return (
    <div ref={scrollRef} className={styles.migrationsPanel}>
      <div className={styles.panelScrollWrapper}>
        {history.children.length
          ? history.children.map((childItem) => (
              <div
                key={childItem.item.name}
                className={styles.childItem}
                onClick={() => setActiveMigrationItem(childItem.item)}
              >
                <svg
                  className={styles.connector}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 62 100"
                >
                  <path d="M 15.5 100 L 15.5 31 a 16 16 0 0 1 15.5 -15.5 h 8" />
                  <circle cx="39" cy="15.5" r="5" />
                </svg>

                <div className={styles.body}>
                  <div className={styles.name}>{childItem.item.name}</div>
                  <div className={styles.branches}>
                    {childItem.branches.map((branchName) => (
                      <div key={branchName} className={styles.branch}>
                        {branchName}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          : null}
        {history.items.map((item) => {
          const body = (
            <div
              key={item.name}
              ref={(el: HTMLDivElement | null) => {
                if (el) {
                  migrationRefs.current.items.set(item, el);
                  migrationRefs.current.els.set(el, item);
                  intersectionObserver.current?.observe(el);
                } else {
                  const el = migrationRefs.current.items.get(item);
                  if (el) {
                    intersectionObserver.current?.unobserve(el);
                    migrationRefs.current.els.delete(el);
                  }
                  migrationRefs.current.items.delete(item);
                }
              }}
              className={cn(styles.migrationItem, {
                [styles.leafItem]: item.children.length == 0,
                [styles.rootItem]: item.parent == null,
              })}
            >
              {item.parent != null ? (
                line
              ) : (
                <svg
                  className={styles.dashedLine}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <line x1="15.5" y1="100%" x2="15.5" y2="0%"></line>
                </svg>
              )}

              <div className={styles.header}>
                {item.parent == null ? line : null}
                <svg
                  className={styles.dot}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 31 31"
                >
                  <circle cx="15.5" cy="15.5" r="5" />
                </svg>
                <div className={styles.name}>{item.name}</div>
              </div>

              <div className={styles.script}>
                {migrationScripts.has(item.name) ? (
                  <>
                    <div className={styles.codeWrapper}>
                      <CodeBlock code={migrationScripts.get(item.name)!} />
                    </div>
                    <div className={styles.copyButtonWrapper}>
                      <div className={styles.copyButtonClip}>
                        <CopyButton
                          className={styles.copyButton}
                          content={migrationScripts.get(item.name)!}
                          mini
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <Spinner className={styles.loading} size={20} />
                )}
              </div>

              {item.parent == null ? (
                <div className={styles.emptySchemaItem}>
                  <svg
                    className={styles.dot}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 31 31"
                  >
                    <circle cx="15.5" cy="15.5" r="5" />
                  </svg>
                  <div className={styles.name}>empty schema</div>
                </div>
              ) : null}
            </div>
          );

          return item.parent == null ? (
            <div style={{minHeight: panelHeight - 6}}>{body}</div>
          ) : (
            body
          );
        })}
      </div>
    </div>
  );
});

export const RelativeTime = observer(function RelativeTime({
  time,
}: {
  time: Date;
}) {
  const cachedTime = useRef<string>();

  if (cachedTime.current) {
    return <span title={time.toLocaleString()}>{cachedTime.current}</span>;
  }

  const diffMins = (currentTimestamp.timestamp - time.getTime()) / 60_000;
  if (diffMins < 1) {
    return <span title={time.toLocaleString()}>{"<"} 1 min ago</span>;
  }
  if (diffMins < 60) {
    const mins = Math.floor(diffMins);
    return (
      <span title={time.toLocaleString()}>
        {mins} min{mins > 1 ? "s" : ""} ago
      </span>
    );
  }
  const diffHours = diffMins / 60;
  if (diffHours < 1) {
    return <span title={time.toLocaleString()}>{"<"} 1 hour ago</span>;
  }
  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return (
      <span title={time.toLocaleString()}>
        {hours} hour{hours > 1 ? "s" : ""} ago
      </span>
    );
  }
  const diffDays = diffHours / 24;
  if (diffDays < 31) {
    const days = Math.floor(diffDays);
    return (
      <span title={time.toLocaleString()}>
        {days} day{days > 1 ? "s" : ""} ago
      </span>
    );
  }

  cachedTime.current = time.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return <span title={time.toLocaleString()}>{cachedTime.current}</span>;
});
