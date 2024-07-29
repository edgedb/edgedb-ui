import {
  Fragment,
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
  ChevronDownIcon,
  WarningIcon,
} from "@edgedb/common/newui";
import {CopyButton} from "../newui/copyButton";
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
  fetchMigrations: (graphItems: GraphItem[]) => Promise<string[]>;
}>(null!);

type SetActivePopup = (el: HTMLElement, popup: JSX.Element) => void;
type GetMigrationIdRef = (
  node: LayoutNode
) => (el: HTMLElement | null) => void;
type SetActiveMigrationNode = (node: LayoutNode) => void;

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
      setRefreshing(false);
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
            findGraphItemBranch(graphItems[graphItems.length - 1])
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
              `Migrations not found for ${graphItems.map((item) => item.name).join(", ")}`
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

  const migrationIdRefs = useRef(new Map<LayoutNode, HTMLElement>());
  const [activeMigrationNode, _setActiveMigrationNode] =
    useState<LayoutNode | null>(null);
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
      _setActiveMigrationNode(null);
    },
    [_setActivePopup, _setActiveMigrationNode]
  );

  const getMigrationIdRef = useCallback(
    (node: LayoutNode) => (el: HTMLElement | null) => {
      if (el) migrationIdRefs.current.set(node, el);
      else migrationIdRefs.current.delete(node);
    },
    [migrationIdRefs.current]
  );

  const setActiveMigrationNode = useCallback(
    (node: LayoutNode) => {
      const el = migrationIdRefs.current.get(node)!;
      const refRect = ref.current!.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      _setActivePopup({
        el: (
          <MigrationPopup
            key={`${node.items[0].name}-${node.items[node.items.length - 1].name}`}
            node={node}
            setActiveMigrationNode={setActiveMigrationNode}
          />
        ),
        pos: {
          top: 100,
          left: (refRect.width - elRect.width) / 2,
          width: elRect.width,
          height: elRect.height,
        },
      });
      _setActiveMigrationNode(node);
    },
    [setActivePopup, _setActiveMigrationNode]
  );

  useEffect(() => {
    if (activePopup && ref.current) {
      const scrollListener = () => {
        _setActivePopup(null);
        _setActiveMigrationNode(null);
      };
      if (!activeMigrationNode) {
        ref.current.addEventListener("scroll", scrollListener);
      }

      const clickListener = (e: MouseEvent) => {
        if (!popupRef.current?.contains(e.target as HTMLElement)) {
          _setActivePopup(null);
          _setActiveMigrationNode(null);
        }
      };
      window.addEventListener("mousedown", clickListener, {capture: true});

      return () => {
        if (!activeMigrationNode) {
          ref.current?.removeEventListener("scroll", scrollListener);
        }

        window.removeEventListener("mousedown", clickListener, {
          capture: true,
        });
      };
    }
  }, [activePopup, activeMigrationNode]);

  useLayoutEffect(() => {
    if (!!activeMigrationNode && ref.current) {
      const padding = Math.max(containerSize.height, containerSize.width) / 2;
      ref.current.scrollTop += padding;
      ref.current.scrollLeft += padding;
    }
  }, [!!activeMigrationNode]);

  useEffect(() => {
    if (activeMigrationNode && ref.current) {
      const el = migrationIdRefs.current.get(activeMigrationNode)!;
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
  }, [activeMigrationNode]);

  return (
    <CustomScrollbars
      className={cn(styles.branchGraph, className)}
      innerClass={styles.nodeGrid}
    >
      <div
        ref={ref}
        className={cn(styles.scrollWrapper, {
          [styles.migrationPopupOpen]: activeMigrationNode != null,
        })}
        style={
          activeMigrationNode
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
                  activeMigrationNode={activeMigrationNode}
                  setActiveMigrationNode={setActiveMigrationNode}
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
  activeMigrationNode,
  setActiveMigrationNode,
  getMigrationIdRef,
}: {
  node: LayoutNode;
  BranchLink: BranchLink;
  githubDetails?: BranchGraphGithubDetails;
  setActivePopup: SetActivePopup;
  activeMigrationNode: LayoutNode | null;
  setActiveMigrationNode: SetActiveMigrationNode;
  getMigrationIdRef: GetMigrationIdRef;
}) {
  const positionStyle = {
    gridColumn: node.col * 2 + 1,
    gridRow: node.row + 1,
  };
  const item = node.items[0];

  if ((node.branchIndex != null && node.branchIndex > 0) || !item.name) {
    return (
      <div className={styles.branchNode} style={positionStyle}>
        <BranchGraphButton
          branchName={
            node.branchIndex
              ? item.branches![node.branchIndex]
              : item.branches![0]
          }
          BranchLink={BranchLink}
          githubDetails={githubDetails}
          setActivePopup={setActivePopup}
          branchLine={node.branchIndex ? node.branchIndex + 1 : undefined}
        />
      </div>
    );
  }

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
          gridRowEnd: node.row + 1,
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
      <div className={styles.migrationNode} style={positionStyle}>
        {item.name ? (
          <>
            <MigrationID
              node={node}
              isActive={activeMigrationNode === node}
              setActiveMigration={setActiveMigrationNode}
              getMigrationIdRef={getMigrationIdRef}
            />
            <svg
              className={cn(styles.line, {
                [styles.root]: !connector,
                [styles.leaf]: !item.children.length,
              })}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 31 31"
              preserveAspectRatio="none"
            >
              <path d="M 0 15.5 H 31" />
            </svg>
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
  isActive,
  setActiveMigration,
  getMigrationIdRef,
}: {
  node: LayoutNode;
  isActive: boolean | null;
  setActiveMigration: SetActiveMigrationNode;
  getMigrationIdRef: GetMigrationIdRef;
}) {
  return (
    <div
      ref={getMigrationIdRef(node)}
      className={cn(styles.migrationId, {
        [styles.multi]: node.items.length > 1,
        [styles.active]: !!isActive,
      })}
      onClick={() => setActiveMigration(node)}
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

const _migrationCache = new Map<string, string>();

function MigrationPopup({
  node,
  setActiveMigrationNode,
}: {
  node: LayoutNode;
  setActiveMigrationNode: SetActiveMigrationNode;
}) {
  const {fetchMigrations} = useContext(BranchGraphContext);
  const [migrationScripts, setMigrationScripts] = useState(() =>
    node.items.map((item) => _migrationCache.get(item.name) ?? null)
  );
  const fetching = useRef(false);

  useEffect(() => {
    const missingItems = node.items.filter(
      (_, i) => migrationScripts[i] == null
    );
    if (missingItems.length && !fetching.current) {
      fetching.current = true;
      fetchMigrations(missingItems)
        .then((scripts) => {
          for (let i = 0; i < scripts.length; i++) {
            _migrationCache.set(missingItems[i].name, scripts[i]);
          }
          setMigrationScripts(
            node.items.map((item) => _migrationCache.get(item.name) ?? null)
          );
        })
        .finally(() => (fetching.current = false));
    }
  }, [migrationScripts]);

  return (
    <div className={styles.migrationPopup}>
      <PopupArrow className={styles.arrow} />

      <div className={styles.popupScrollWrapper}>
        {[...node.items].map((item, i) => (
          <Fragment key={item.name}>
            <div className={styles.name}>{item.name}</div>
            <div className={styles.script}>
              {migrationScripts[i] != null ? (
                <>
                  <div className={styles.codeWrapper}>
                    <CodeBlock code={migrationScripts[i]!} />
                  </div>
                  <CopyButton
                    className={styles.copyButton}
                    content={migrationScripts[i]!}
                    mini
                  />
                </>
              ) : (
                <Spinner className={styles.loading} size={20} />
              )}
            </div>
          </Fragment>
        ))}
      </div>

      {node.parentNode ? (
        <div className={styles.prevItems}>
          <div
            className={styles.itemButton}
            onClick={() => setActiveMigrationNode(node.parentNode!)}
          >
            <ChevronDownIcon />
            {node.parentNode.items[
              node.parentNode.items.length - 1
            ].name.slice(2, 10)}
          </div>
        </div>
      ) : null}
      {node.childrenNodes.length ? (
        <div className={styles.nextItems}>
          {node.childrenNodes
            .filter(
              (node) => node.branchIndex == null || node.branchIndex === 0
            )
            .map((child) => (
              <div
                key={child.items[0].name}
                className={styles.itemButton}
                onClick={() => setActiveMigrationNode(child)}
              >
                {child.items[0].name.slice(2, 10)}
                <ChevronDownIcon />
              </div>
            ))}
        </div>
      ) : null}
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
