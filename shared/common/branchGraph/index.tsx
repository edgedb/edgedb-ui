import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  CopyIcon,
  ChevronDownIcon,
  WarningIcon,
} from "@edgedb/common/newui";
import {PopupArrow} from "../newui/icons/other";

import {
  GraphItem,
  LayoutNode,
  buildBranchGraph,
  fetchMigrationsData,
  findGraphItemBranch,
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
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }>
) => JSX.Element;

export interface BranchGraphProps {
  className?: string;
  instanceId?: string;
  instanceState: InstanceState | Error | null;
  BranchLink: BranchLink;
  githubDetails?: BranchGraphGithubDetails;
  BottomButton?: (props: {className?: string}) => JSX.Element;
}

export const BranchGraphContext = createContext<{
  fetchMigration: (graphItem: GraphItem) => Promise<string>;
}>(null!);

type SetActivePopup = (el: HTMLElement, popup: JSX.Element) => void;
type GetMigrationIdRef = (
  items: GraphItem[]
) => (el: HTMLElement | null) => void;
type SetActiveMigrationItem = (item: GraphItem) => void;

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

  const fetchMigration =
    instanceState instanceof Error
      ? () => {
          throw new Error(`Error connecting to instance`);
        }
      : async (graphItem: GraphItem) => {
          const conn = instanceState!.getConnection(
            findGraphItemBranch(graphItem)
          );
          const result = await conn.query(
            `select (
        select schema::Migration
        filter .name = <str>$name
      ).script`,
            {name: graphItem.name}
          );
          const script = result.result?.[0];
          if (script == null) {
            throw new Error(`No migration found for ${graphItem.name}`);
          }
          return script;
        };

  return (
    <BranchGraphContext.Provider
      value={{
        fetchMigration,
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

export function _BranchGraphRenderer({
  className,
  BranchLink,
  TopButton,
  BottomButton,
  layoutNodes,
  githubDetails,
}: Pick<
  BranchGraphProps,
  "className" | "BranchLink" | "BottomButton" | "githubDetails"
> & {
  layoutNodes: LayoutNode[] | null | Error;
  TopButton?: (props: {className?: string}) => JSX.Element;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const migrationIdRefs = useRef(new Map<GraphItem, HTMLElement>());
  const [activeMigrationItem, _setActiveMigrationItem] =
    useState<GraphItem | null>(null);
  const [activePopup, _setActivePopup] = useState<{
    pos: {top: number; left: number; width: number; height: number};
    el: JSX.Element;
  } | null>(null);

  const [containerSize, setContainerSize] = useState({width: 0, height: 0});

  useResize(ref, ({width, height}) => setContainerSize({width, height}));

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
      _setActiveMigrationItem(null);
    },
    [_setActivePopup, _setActiveMigrationItem]
  );

  const getMigrationIdRef = useCallback(
    (items: GraphItem[]) => (el: HTMLElement | null) => {
      for (const item of items) {
        if (el) migrationIdRefs.current.set(item, el);
        else migrationIdRefs.current.delete(item);
      }
    },
    [migrationIdRefs.current]
  );

  const setActiveMigrationItem = useCallback(
    (item: GraphItem) => {
      const el = migrationIdRefs.current.get(item)!;
      const refRect = ref.current!.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      _setActivePopup({
        el: (
          <MigrationPopup
            key={item.name}
            graphItem={item}
            setActiveMigrationItem={setActiveMigrationItem}
          />
        ),
        pos: {
          top: 100,
          left: (refRect.width - elRect.width) / 2,
          width: elRect.width,
          height: elRect.height,
        },
      });
      _setActiveMigrationItem(item);
    },
    [setActivePopup, _setActiveMigrationItem]
  );

  useEffect(() => {
    if (activePopup && ref.current) {
      const scrollListener = () => {
        _setActivePopup(null);
        _setActiveMigrationItem(null);
      };
      if (!activeMigrationItem) {
        ref.current.addEventListener("scroll", scrollListener);
      }

      const clickListener = (e: MouseEvent) => {
        if (!popupRef.current?.contains(e.target as HTMLElement)) {
          _setActivePopup(null);
          _setActiveMigrationItem(null);
        }
      };
      window.addEventListener("mousedown", clickListener, {capture: true});

      return () => {
        if (!activeMigrationItem) {
          ref.current?.removeEventListener("scroll", scrollListener);
        }

        window.removeEventListener("mousedown", clickListener, {
          capture: true,
        });
      };
    }
  }, [activePopup, activeMigrationItem]);

  useLayoutEffect(() => {
    if (!!activeMigrationItem && ref.current) {
      const padding = Math.max(containerSize.height, containerSize.width) / 2;
      ref.current.scrollTop += padding;
      ref.current.scrollLeft += padding;
    }
  }, [!!activeMigrationItem]);

  useEffect(() => {
    if (activeMigrationItem && ref.current) {
      const el = migrationIdRefs.current.get(activeMigrationItem)!;
      const refRect = ref.current!.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      ref.current.scrollTo({
        top:
          ref.current.scrollTop +
          (elRect.top - refRect.top - activePopup!.pos.top),
        left:
          ref.current.scrollLeft +
          (elRect.left - refRect.left - activePopup!.pos.left),
        behavior: "smooth",
      });
    }
  }, [activeMigrationItem]);

  return (
    <CustomScrollbars
      className={cn(styles.branchGraph, className)}
      innerClass={styles.nodeGrid}
    >
      <div
        ref={ref}
        className={cn(styles.scrollWrapper, {
          [styles.migrationPopupOpen]: activeMigrationItem != null,
        })}
        style={
          activeMigrationItem
            ? ({
                "--extraPadding": `${
                  Math.max(containerSize.width, containerSize.height) / 2
                }px`,
              } as any)
            : undefined
        }
      >
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
                  activeMigrationItem={activeMigrationItem}
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
          {TopButton ? <TopButton className={styles.floatingButton} /> : null}
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
  );
}

function BranchGraphNode({
  node,
  BranchLink,
  githubDetails,
  setActivePopup,
  activeMigrationItem,
  setActiveMigrationItem,
  getMigrationIdRef,
}: {
  node: LayoutNode;
  BranchLink: BranchLink;
  githubDetails?: BranchGraphGithubDetails;
  setActivePopup: SetActivePopup;
  activeMigrationItem: GraphItem | null;
  setActiveMigrationItem: SetActiveMigrationItem;
  getMigrationIdRef: GetMigrationIdRef;
}) {
  const [hovered, setHovered] = useState(false);
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
          straightLine ? styles.line : styles.curved
        )}
        style={{
          gridColumn: node.col * 2,
          gridRowStart: node.parentNode.row + 1,
          gridRowEnd: node.row + 2,
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

  const positionStyle = {
    gridColumn: node.col * 2 + 1,
    gridRow: node.row + 1,
  };

  if (node.branchIndex != null) {
    const item = node.items[0];
    const branchName = item.branches![node.branchIndex];

    const githubBranch = githubDetails?.branches.find(
      (b) => b.db_branch_name === branchName
    );

    return (
      <>
        {connector}
        <div
          className={cn(styles.branchNode, {
            [styles.rootBranch]: item.name === "" || !node.parentNode,
          })}
          style={positionStyle}
        >
          {item.name && node.branchIndex === 0 ? (
            <MigrationID
              items={[item]}
              isActive={
                activeMigrationItem && node.items.includes(activeMigrationItem)
              }
              setActiveMigration={setActiveMigrationItem}
              getMigrationIdRef={getMigrationIdRef}
            />
          ) : null}

          {node.branchIndex === 0 && item.children.length ? (
            <svg
              className={styles.line}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 31 31"
              preserveAspectRatio="none"
            >
              <path d="M 0 15.5 H 31" />
            </svg>
          ) : null}

          {node.branchIndex > 0 ? (
            <svg
              className={styles.duplicateBranchConnector}
              xmlns="http://www.w3.org/2000/svg"
              width="8"
              height="64"
              viewBox="0 0 8 64"
              fill="none"
            >
              <path d="M 4 0 V 64" />
            </svg>
          ) : null}

          <div
            className={cn(styles.branchButton, {[styles.hovered]: hovered})}
          >
            <BranchLink
              className={styles.branchName}
              branchName={branchName}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <span>
                <bdo dir="ltr" title={branchName}>
                  {branchName}
                </bdo>
              </span>
              <ArrowRightIcon />
            </BranchLink>
            {githubBranch ? (
              <div
                className={cn(
                  styles.githubDetails,
                  styles[githubBranch.status]
                )}
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
                {githubBranch.status === "updating" ? (
                  <>
                    <SyncIcon />
                    <span>Syncing</span>
                  </>
                ) : (
                  <>
                    {githubBranch.status === "up-to-date" ? (
                      <CheckIcon />
                    ) : (
                      <CrossIcon />
                    )}
                    <span>
                      <RelativeTime time={githubBranch.last_updated_at!} />
                    </span>
                  </>
                )}
                <GithubLogo className={styles.githubIcon} />
              </div>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {connector}
      <div className={styles.migrationNode} style={positionStyle}>
        <MigrationID
          items={node.items}
          isActive={
            activeMigrationItem && node.items.includes(activeMigrationItem)
          }
          setActiveMigration={setActiveMigrationItem}
          getMigrationIdRef={getMigrationIdRef}
        />
        <svg
          className={cn(styles.line, {[styles.root]: !connector})}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 31 31"
          preserveAspectRatio="none"
        >
          <path d="M 0 15.5 H 31" />
        </svg>
        {node.items.length > 1 ? (
          <svg
            className={styles.dot}
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
      </div>
    </>
  );
}

function GithubBranchPopup({
  githubSlug,
  repoName,
  githubBranch: {status, latest_commit_sha, pr_issue_number},
}: {
  githubSlug: string;
  repoName: string;
  githubBranch: BranchGraphGithubBranch;
}) {
  return (
    <div className={styles.githubBranchPopup}>
      <PopupArrow className={styles.arrow} />
      <span>
        {status === "up-to-date"
          ? "Up to date with"
          : status === "updating"
          ? "Syncing from"
          : "Failed to sync from"}
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
  items,
  isActive,
  setActiveMigration,
  getMigrationIdRef,
}: {
  items: GraphItem[];
  isActive: boolean | null;
  setActiveMigration: SetActiveMigrationItem;
  getMigrationIdRef: GetMigrationIdRef;
}) {
  return (
    <div
      ref={getMigrationIdRef(items)}
      className={cn(styles.migrationId, {[styles.active]: !!isActive})}
      onClick={() => setActiveMigration(items[0])}
    >
      {items.length > 1
        ? `${items[0].name.slice(2, 10)} - ${items[
            items.length - 1
          ].name.slice(2, 10)}`
        : items[0].name.slice(2, 10)}
      <MigrationsListIcon />
    </div>
  );
}

const _migrationCache = new Map<string, string>();

function MigrationPopup({
  graphItem,
  setActiveMigrationItem,
}: {
  graphItem: GraphItem;
  setActiveMigrationItem: SetActiveMigrationItem;
}) {
  const {fetchMigration} = useContext(BranchGraphContext);
  const [migrationScript, setMigrationScript] = useState(
    _migrationCache.get(graphItem.name)
  );
  const fetching = useRef(false);

  useEffect(() => {
    if (!migrationScript && !fetching.current) {
      fetching.current = true;
      fetchMigration(graphItem)
        .then((script) => {
          _migrationCache.set(graphItem.name, script);
          setMigrationScript(script);
        })
        .finally(() => (fetching.current = false));
    }
  }, [migrationScript]);

  return (
    <div className={styles.migrationPopup}>
      <PopupArrow className={styles.arrow} />
      <div className={styles.name}>{graphItem.name}</div>
      <div className={styles.script}>
        {migrationScript != null ? (
          <>
            <div className={styles.codeWrapper}>
              <CodeBlock code={migrationScript} />
            </div>
            <CopyButton code={migrationScript} />
          </>
        ) : (
          <Spinner className={styles.loading} size={20} />
        )}
      </div>

      {graphItem.parent ? (
        <div className={styles.prevItems}>
          <div
            className={styles.itemButton}
            onClick={() => setActiveMigrationItem(graphItem.parent!)}
          >
            <ChevronDownIcon />
            {graphItem.parent.name.slice(2, 10)}
          </div>
        </div>
      ) : null}
      {graphItem.children.length ? (
        <div className={styles.nextItems}>
          {graphItem.children.map((child) => (
            <div
              key={child.name}
              className={styles.itemButton}
              onClick={() => setActiveMigrationItem(child)}
            >
              {child.name.slice(2, 10)}
              <ChevronDownIcon />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CopyButton({code}: {code: string}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [copied]);

  return (
    <div
      className={cn(styles.copyButton, {[styles.copied]: copied})}
      onClick={() => {
        navigator.clipboard?.writeText(code);
        setCopied(true);
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </div>
  );
}

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
