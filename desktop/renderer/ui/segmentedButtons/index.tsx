import {useEffect, useRef, useState} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./segmentedButtons.module.scss";

interface SegmentedButtonsProps<T extends string> {
  className?: string;
  buttons: {
    id: T;
    label: string;
  }[];
  selected: T;
  disabled?: Set<T>;
  onClick: (id: T) => void;
}

export default function SegmentedButtons<T extends string>({
  className,
  buttons,
  selected,
  disabled,
  onClick,
}: SegmentedButtonsProps<T>) {
  const [selectedSize, setSelectedSize] = useState<{
    width: number;
    left: number;
  } | null>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (buttonsRef.current) {
      const selectedIndex = buttons.findIndex(
        (button) => button.id === selected
      );
      const buttonEl = buttonsRef.current.childNodes[
        selectedIndex
      ] as HTMLButtonElement;

      setSelectedSize({
        width: buttonEl.clientWidth,
        left: buttonEl.offsetLeft,
      });
    }
  }, [buttonsRef, buttons, selected]);

  return (
    <div ref={buttonsRef} className={cn(styles.buttonGroup, className)}>
      {buttons.map((button) => (
        <button
          key={button.id}
          className={cn({
            [styles.selected]: selected === button.id,
          })}
          disabled={disabled?.has(button.id)}
          onClick={() => onClick(button.id)}
        >
          {button.label}
        </button>
      ))}
      {selectedSize ? (
        <div
          className={styles.floatingMarker}
          style={{
            left: selectedSize.left + "px",
            width: selectedSize.width + "px",
          }}
        />
      ) : null}
    </div>
  );
}
