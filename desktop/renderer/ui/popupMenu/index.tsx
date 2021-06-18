import {useRef, useState} from "react";
import {createPortal} from "react-dom";
import {observable} from "mobx";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {KebabMenuIcon} from "../../components/icons";

import styles from "./popupMenu.module.scss";

let popupMenuId = 0;
const activePopupMenu = observable.box<{
  id: number;
  top: number;
  left: number;
} | null>(null, {deep: false});

interface PopupMenuProps {
  className?: string;
  items: {label: string; action: () => void}[];
}

export default observer(function PopupMenu({
  className,
  items,
}: PopupMenuProps) {
  const [id] = useState(() => popupMenuId++);

  const popupRef = useRef<HTMLDivElement>(null);

  const menuOpen = activePopupMenu.get()?.id === id;

  const openMenu = () => {
    const BBox = popupRef.current?.getBoundingClientRect();
    if (BBox) {
      activePopupMenu.set({id, top: BBox.top, left: BBox.left});
    }
  };

  return (
    <>
      <div
        ref={popupRef}
        className={cn(styles.popupMenu, className)}
        onClick={openMenu}
      >
        <KebabMenuIcon />
      </div>
      {menuOpen ? <PopupMenuPanel id={id} items={items} /> : null}
    </>
  );
});

function PopupMenuPanel({
  id,
  items,
}: {id: number} & Pick<PopupMenuProps, "items">) {
  const targetEl = document.getElementById("popupMenuPortalTarget");
  const {top, left} = activePopupMenu.get()!;

  return targetEl
    ? createPortal(
        <div
          className={styles.popupMenuOverlay}
          onClick={() => activePopupMenu.set(null)}
        >
          <div
            className={styles.popupMenuPanel}
            style={{
              top: `${top}px`,
              left: `${left}px`,
            }}
          >
            {items.map((item, i) => (
              <div
                key={i}
                className={styles.popupMenuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  activePopupMenu.set(null);
                  item.action();
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>,
        targetEl,
        `${id}`
      )
    : null;
}
