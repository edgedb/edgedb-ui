import {
  createContext,
  Fragment,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {observer} from "mobx-react-lite";
import {
  useLocation,
  useNavigate,
  createSearchParams,
  NavigateFunction,
} from "react-router-dom";
import Fuse from "fuse.js";

import cn from "@edgedb/common/utils/classNames";
import {
  SchemaExtension,
  SchemaObjectType,
  SchemaType,
} from "@edgedb/common/schemaData";

import styles from "../textView.module.scss";

import {ArrowRight, ChevronDownIcon, CopyIcon} from "../../../icons";

import {
  getModuleGroup,
  ModuleGroup,
  SchemaItem,
  SchemaTextView,
} from "../state/textView";
import {useSchemaTextState} from "../textView";
import {useDatabaseState, useTabState} from "../../../state";
import {Schema, SchemaViewType} from "../state";

export function Keyword({children}: PropsWithChildren<{}>) {
  return <span className={styles.kw}>{children}</span>;
}

export function Punc({children}: PropsWithChildren<{}>) {
  return <span className={styles.punc}>{children}</span>;
}

export function Str({children}: PropsWithChildren<{}>) {
  return <span className={styles.string}>'{children}'</span>;
}

export function Arrow() {
  return <span className={styles.arrow}>{"->"}</span>;
}

export function CollapseArrow({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(styles.collapseArrow, {[styles.collapsed]: collapsed})}
      onClick={onToggle}
    >
      <div>
        <ChevronDownIcon />
      </div>
    </div>
  );
}

export function highlightString(
  str: string,
  indices: readonly [number, number][]
) {
  const highlighted: (string | JSX.Element)[] = [];
  let cursor = 0;
  for (const [start, end] of indices) {
    highlighted.push(str.slice(cursor, start));

    highlighted.push(
      <span key={highlighted.length} className={styles.searchMatch}>
        {str.slice(start, end + 1)}
      </span>
    );
    cursor = end + 1;
  }
  highlighted.push(str.slice(cursor));
  return highlighted;
}

function goToItem(
  navigate: NavigateFunction,
  state: SchemaTextView,
  item: Exclude<SchemaItem, SchemaExtension>
) {
  const moduleGroup = getModuleGroup(item);
  navigate({
    pathname: moduleGroup === ModuleGroup.user ? "" : ModuleGroup[moduleGroup],
    search: createSearchParams({focus: item.name}).toString(),
  });
  state.goToItem(item);
}

export function TypeLink({
  type,
  parentModule,
}: {
  type: SchemaItem | SchemaType;
  parentModule: string;
}) {
  const schemaData = useDatabaseState().schemaData!;
  const state = useSchemaTextState();
  const navigate = useNavigate();

  function wrapLink(type: SchemaItem | SchemaType): JSX.Element {
    if (type.schemaType === "Pseudo" || type.schemaType === "Extension") {
      return <>{type.name}</>;
    }
    if (type.schemaType === "Tuple") {
      return (
        <>
          <span className={styles.builtin}>tuple</span>
          {"<"}
          {type.elements.map((el, i) => (
            <Fragment key={i}>
              {(i !== 0 ? ", " : "") + (type.named ? `${el.name}: ` : "")}
              {wrapLink(el.type)}
            </Fragment>
          ))}
          {">"}
        </>
      );
    }
    if (type.schemaType === "Array") {
      return (
        <>
          <span className={styles.builtin}>array</span>
          {"<"}
          {wrapLink(type.elementType)}
          {">"}
        </>
      );
    }
    if (type.schemaType === "Range") {
      return (
        <>
          <span className={styles.builtin}>range</span>
          {"<"}
          {wrapLink(type.elementType)}
          {">"}
        </>
      );
    }

    return (
      <span
        className={styles.typeLink}
        onClick={() => {
          goToItem(navigate, state, type);
        }}
      >
        {type.module === parentModule ||
        (type.module === "std" &&
          !schemaData.shortNamesByModule
            .get(parentModule)!
            .has(type.shortName)) ? null : (
          <span>{type.module}::</span>
        )}
        {type.shortName}
      </span>
    );
  }

  return wrapLink(type);
}

export function TypeName({
  type,
  matches,
}: {
  type: {module: string; shortName: string};
  matches?: Fuse.FuseResultMatch[];
}) {
  if (matches) {
    const modMatch = matches.find((match) => match.key === "module");
    const nameMatch = matches.find((match) => match.key === "name");
    return (
      <>
        <span className={styles.mod}>
          {modMatch
            ? highlightString(type.module, modMatch.indices)
            : type.module}
          ::
        </span>
        {nameMatch
          ? highlightString(type.shortName, nameMatch.indices)
          : type.shortName}
      </>
    );
  } else {
    return <>{type.shortName}</>;
  }
}

export function mapTypeLinkList(
  types: (SchemaItem | SchemaType)[],
  parentModule: string
) {
  return types.map((t, i) => (
    <Fragment key={i}>
      {i !== 0 ? ", " : ""}
      <TypeLink type={t} parentModule={parentModule} />
    </Fragment>
  ));
}

export function indent(code: string, indent: string = "  ") {
  return indent + code.replace(/\n/g, "\n" + indent);
}

export function ItemHeader({
  children,
  actions,
}: PropsWithChildren<{actions?: JSX.Element}>) {
  return (
    <div className={styles.itemHeader}>
      <div>{children}</div>
      {actions ? <div className={styles.itemActions}>{actions}</div> : null}
    </div>
  );
}

export const ShowInGraphButton = observer(function ShowInGraphButton({
  type,
}: {
  type: SchemaObjectType;
}) {
  const tabState = useTabState(Schema);
  const state = useSchemaTextState();
  const navigate = useNavigate();

  return !type.builtin && tabState.viewType === SchemaViewType.TextGraph ? (
    <div
      className={cn(styles.showInGraphButton)}
      onClick={() => goToItem(navigate, state, type)}
    >
      Show in Graph <ArrowRight />
    </div>
  ) : null;
});

const CopyContext = createContext<(active: boolean) => void>(null!);

export function Copyable({children}: PropsWithChildren<{}>) {
  const [copyHighlight, setCopyHighlight] = useState(false);

  return (
    <CopyContext.Provider value={setCopyHighlight}>
      <div
        style={{display: "contents"}}
        className={cn({[styles.showCopyHighlight]: copyHighlight})}
      >
        {children}
      </div>
    </CopyContext.Provider>
  );
}

export function CopyButton({getSDL}: {getSDL: () => string}) {
  const setCopyHighlight = useContext(CopyContext);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 1000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [copied]);

  return (
    <div
      className={styles.copyButton}
      onMouseEnter={() => setCopyHighlight(true)}
      onMouseLeave={() => setCopyHighlight(false)}
      onClick={() => {
        navigator.clipboard?.writeText(getSDL());
        setCopied(true);
      }}
    >
      <CopyIcon />
      {copied ? "Copied" : "Copy"}
    </div>
  );
}

export function CopyHighlight({children}: PropsWithChildren<{}>) {
  return <span className={styles.copyHighlight}>{children}</span>;
}
