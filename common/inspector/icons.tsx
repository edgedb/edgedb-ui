import React from "react";

type IconProps = {
  className?: string;
};

export const Expanded = ({className}: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className || ""}
      width="24"
      height="24"
      viewBox="0 0 24 24"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path fill="currentColor" d="M7 10l5 5 5-5z" />
    </svg>
  );
};

export const Collapsed = ({className}: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className || ""}
      width="24"
      height="24"
      viewBox="0 0 24 24"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path fill="currentColor" d="M10 17l5-5-5-5v10z" />
    </svg>
  );
};

export const More = ({className}: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className || ""}
      width="24"
      height="24"
      viewBox="0 0 24 24"
    >
      <circle fill="currentColor" cx="8" cy="12" r="1"></circle>
      <circle fill="currentColor" cx="12" cy="12" r="1"></circle>
      <circle fill="currentColor" cx="16" cy="12" r="1"></circle>
    </svg>
  );
};
