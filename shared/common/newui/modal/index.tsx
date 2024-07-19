import {HTMLAttributes, PropsWithChildren} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./modal.module.scss";
import {CrossIcon, WarningIcon} from "../icons";

export interface ModalProps {
  className?: string;
  title: string;
  subheading?: string;
  onClose?: () => void;
  noCloseOnOverlayClick?: boolean;
  onSubmit?: () => void;
  formError?: string | null;
  footerButtons?: JSX.Element;
  footerDetails?: JSX.Element;
  footerExtra?: JSX.Element;
}

export function Modal({
  className,
  title,
  subheading,
  onClose,
  noCloseOnOverlayClick,
  onSubmit,
  formError,
  children,
  footerDetails,
  footerButtons,
  footerExtra,
}: PropsWithChildren<ModalProps>) {
  const El = onSubmit ? "form" : "div";

  return (
    <div
      className={styles.modalOverlay}
      onClick={
        onClose && !noCloseOnOverlayClick
          ? (e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }
          : undefined
      }
    >
      <El
        className={cn(styles.modal, className)}
        onSubmit={
          onSubmit
            ? (e) => {
                e.preventDefault();
                onSubmit();
              }
            : undefined
        }
        autoComplete="off"
      >
        <div className={styles.header}>
          <div className={styles.headings}>
            <div className={styles.title}>{title}</div>
            {subheading ? (
              <div className={styles.subheading}>{subheading}</div>
            ) : null}
          </div>
          <div
            className={styles.closeButton}
            onClick={onClose && (() => onClose())}
          >
            <CrossIcon />
          </div>
        </div>
        {children}
        {formError ? (
          <div className={styles.formError}>
            <WarningIcon />
            <div>{formError}</div>
          </div>
        ) : null}
        {footerButtons || footerDetails ? (
          <div className={styles.footer}>
            {footerExtra}
            <div className={styles.footerMain}>
              <div className={styles.footerDetails}>{footerDetails}</div>
              {footerButtons}
            </div>
          </div>
        ) : null}
      </El>
    </div>
  );
}

export function ModalContent({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn(styles.content, className)} {...props} />;
}
