import cn from "@edgedb/common/utils/classNames";
import {CrossIcon, RunIcon} from "../../icons";
import Spinner from "../../spinner";
import styles from "./button.module.scss";

interface CloseButtonProps {
  onClick: () => void;
  className?: string;
}

export const CloseButton = ({onClick, className}: CloseButtonProps) => (
  <button
    onClick={onClick}
    className={cn(styles.container, styles.close, className)}
  >
    <CrossIcon />
  </button>
);

interface RunButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

export const RunButton = ({
  onClick,
  className,
  disabled = false,
  isLoading = false,
}: RunButtonProps) => (
  <button
    className={cn(styles.container, styles.run, className)}
    onClick={onClick}
    disabled={disabled}
  >
    {isLoading ? <Spinner size={22} /> : <RunIcon />}
  </button>
);
