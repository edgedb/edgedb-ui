import cn from "@edgedb/common/utils/classNames";
import {CrossIcon} from "../icons";
import styles from "./closeButton.module.scss";

interface CloseButtonProps {
  onClick: () => void;
  className?: string;
}

const CloseButton = ({onClick, className}: CloseButtonProps) => (
  <button onClick={onClick} className={cn(styles.container, className)}>
    <CrossIcon />
  </button>
);

export default CloseButton;
