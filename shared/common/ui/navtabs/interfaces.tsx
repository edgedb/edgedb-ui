import {HTMLProps, PropsWithChildren} from "react";

export interface Tab<Id extends string> {
  id: Id;
  label: string;
  shortLabel?: string;
  icon: (active: boolean) => JSX.Element;
}

export interface BaseTabBarProps<TabId extends string = string> {
  tabs: Tab<TabId>[];
  currentTabId: TabId;
  Link: (
    params: PropsWithChildren<{to: string; className?: string}> &
      HTMLProps<HTMLAnchorElement>
  ) => JSX.Element;
  className?: string;
}
