import {useState} from "react";

import cn from "@edgedb/common/utils/classNames";

import Button from "../button";

import styles from "./switcherButton.module.scss";

interface SwitcherButtonProps<T extends string | number> {
  className?: string;
  items: {
    id: T;
    label: string;
  }[];
  selected: T;
  onChange: (id: T) => void;
}

export default function SwitcherButton<T extends string | number>({
  className,
  items,
  selected,
  onChange,
}: SwitcherButtonProps<T>) {
  const [popupOpen, setPopupOpen] = useState(false);

  return (
    <div className={cn(styles.switcherButton, className)}>
      <Button
        label={items.find((item) => item.id === selected)?.label ?? ""}
        onClick={() => setPopupOpen(true)}
      />
      {popupOpen ? (
        <div className={styles.popup}>
          {items.map((item) =>
            item.id === selected ? null : (
              <div
                key={item.id}
                className={styles.item}
                onClick={() => {
                  setPopupOpen(false);
                  onChange(item.id);
                }}
              >
                {item.label}
              </div>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
