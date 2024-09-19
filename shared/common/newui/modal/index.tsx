import {HTMLAttributes, PropsWithChildren} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./modal.module.scss";
import {CrossIcon, WarningIcon} from "../icons";

export interface ModalProps {
  className?: string;
  title: string;
  subheading?: string | JSX.Element;
  onClose?: () => void;
  noCloseOnOverlayClick?: boolean;
  onSubmit?: () => void;
  formError?: string | null;
  footerButtons?: JSX.Element;
  footerDetails?: JSX.Element;
  footerExtra?: JSX.Element;
}

export function ModalPanel({
  className,
  noHeader,
  title,
  subheading,
  onClose,
  onSubmit,
  formError,
  children,
  footerDetails,
  footerButtons,
  footerExtra,
}: PropsWithChildren<
  | ({noHeader?: false} & Omit<ModalProps, "noCloseOnOverlayClick">)
  | ({
      noHeader: true;
      title?: undefined;
      subheading?: undefined;
      onClose?: undefined;
    } & Omit<
      ModalProps,
      "noCloseOnOverlayClick" | "title" | "subheading" | "onClose"
    >)
>) {
  const El = onSubmit ? "form" : "div";

  return (
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
      {!noHeader ? (
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
      ) : null}
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
  );
}

export function ModalOverlay({
  noCloseOnOverlayClick,
  onClose,
  children,
}: PropsWithChildren<Pick<ModalProps, "noCloseOnOverlayClick" | "onClose">>) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={
        onClose && !noCloseOnOverlayClick
          ? (e) => {
              if (e.target === e.currentTarget) {
                onClose!();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export function Modal({
  noCloseOnOverlayClick,
  ...props
}: PropsWithChildren<ModalProps>) {
  return (
    <ModalOverlay
      noCloseOnOverlayClick={noCloseOnOverlayClick}
      onClose={props.onClose}
    >
      <ModalPanel {...props} />
    </ModalOverlay>
  );
}

export function ModalContent({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn(styles.content, className)} {...props} />;
}
