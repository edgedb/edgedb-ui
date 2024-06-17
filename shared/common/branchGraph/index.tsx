import {PropsWithChildren, useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";
import {InstanceState} from "@edgedb/studio/state/instance";
import {currentTimestamp} from "@edgedb/common/utils/relativeTime";

import {
  ArrowRightIcon,
  CheckIcon,
  CrossIcon,
  SyncIcon,
  GithubLogo,
} from "@edgedb/common/newui";

import {LayoutNode, getBranchGraphData, layoutBranchGraph} from "./layout";

import styles from "./branchGraph.module.scss";
import {CustomScrollbars} from "../ui/customScrollbar";

export interface BranchGraphGithubBranch {
  // branch_name: z.string(),
  // deleted: z.boolean(),
  status: "updating" | "error" | "up-to-date" | `unknown_${string}`;
  last_updated_at: Date | null;
  // error_message: z.string().nullable(),
  // latest_commit_sha: z.string(),
  db_branch_name: string | null;
  // pr_issue_number: z.number().nullable(),
  // created_on: zDate,
}

type BranchLink = (
  props: PropsWithChildren<{
    className?: string;
    branchName: string;
  }>
) => JSX.Element;

export interface BranchGraphProps {
  className?: string;
  instanceId: string;
  instanceState: InstanceState;
  BranchLink: BranchLink;
  githubBranches?: BranchGraphGithubBranch[];
}

export const BranchGraph = observer(function BranchGraph({
  className,
  instanceId,
  instanceState,
  BranchLink,
  githubBranches,
}: BranchGraphProps) {
  const [refreshing, setRefreshing] = useState(true);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[] | null>(null);

  useEffect(() => {
    if (!refreshing) return;
    getBranchGraphData(instanceId, instanceState).then((data) => {
      if (!data) return;
      console.log(data);
      const allNodes: LayoutNode[] = [];
      let startCol = 0;
      for (const graphRoot of data.graphRoots) {
        const {nodes, maxCol} = layoutBranchGraph(graphRoot, startCol);
        console.log(nodes, maxCol);
        allNodes.push(...nodes);
        startCol = maxCol + 1;
      }
      for (const branch of data.emptyBranches) {
        allNodes.push({
          row: 0,
          col: startCol,
          items: [{name: "", parent: null, children: [], branches: [branch]}],
          branchIndex: 0,
          parentNode: null,
        });
        startCol += 1;
      }
      setLayoutNodes(allNodes);
      setRefreshing(false);
    });
  }, [refreshing]);

  return (
    <CustomScrollbars
      className={cn(styles.branchGraph, className)}
      innerClass={styles.nodeGrid}
    >
      <div className={styles.scrollWrapper}>
        {layoutNodes ? (
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
                githubBranches={githubBranches}
              />
            ))}
          </div>
        ) : (
          <div>loading...</div>
        )}
      </div>
      <button
        className={cn(styles.floatingButton, {
          [styles.refreshing]: refreshing,
        })}
        onClick={() => {
          localStorage.removeItem(`edgedb-branch-graph-${instanceId}`);
          setRefreshing(true);
        }}
      >
        <SyncIcon />
      </button>
    </CustomScrollbars>
  );
});

function BranchGraphNode({
  node,
  BranchLink,
  githubBranches,
}: {
  node: LayoutNode;
  BranchLink: BranchLink;
  githubBranches?: BranchGraphGithubBranch[];
}) {
  let connector: JSX.Element | null = null;

  if (node.parentNode) {
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

    const githubBranch = githubBranches?.find(
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
            <div className={styles.migrationId}>{item.name.slice(2, 10)}</div>
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

          <BranchLink className={styles.branchButton} branchName={branchName}>
            <div className={styles.branchName}>
              {branchName}
              <ArrowRightIcon />
            </div>
            {githubBranch ? (
              <div
                className={cn(
                  styles.githubDetails,
                  styles[githubBranch.status]
                )}
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
          </BranchLink>
        </div>
      </>
    );
  }

  return (
    <>
      {connector}
      <div className={styles.migrationNode} style={positionStyle}>
        <div className={styles.migrationId}>
          {node.items.length > 1
            ? `+${node.items.length}`
            : node.items[0].name.slice(2, 10)}
        </div>

        <svg
          className={styles.line}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 31 31"
          preserveAspectRatio="none"
        >
          <path d="M 0 15.5 H 31" />
        </svg>
        <svg
          className={styles.dot}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 31 31"
        >
          <circle cx="15.5" cy="15.5" r="5" />
        </svg>
      </div>
    </>
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
