import {HTMLAttributes} from "react";

export function ButtonTabArrow(props: HTMLAttributes<SVGSVGElement>) {
  return (
    <svg
      width="31"
      height="10"
      viewBox="0 0 31 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M17.012 0.743849L20.4138 4.66897C23.0729 7.73725 26.9332 9.49995 30.9934 9.49995H0.0078125C4.06805 9.49995 7.92828 7.73725 10.5875 4.66898L13.9892 0.743851C14.7867 -0.176335 16.2145 -0.176336 17.012 0.743849Z" />
    </svg>
  );
}

export function SettingsIcon(props: HTMLAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="24"
      viewBox="0 0 16 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 4C5 3.44772 4.55228 3 4 3C3.44772 3 3 3.44772 3 4V5L1 5C0.447715 5 0 5.44772 0 6C0 6.55228 0.447715 7 1 7H3V8C3 8.55228 3.44772 9 4 9C4.55229 9 5 8.55228 5 8V7L15 7C15.5523 7 16 6.55229 16 6C16 5.44772 15.5523 5 15 5L5 5V4ZM7 14C7.55228 14 8 14.4477 8 15V16L15 16C15.5523 16 16 16.4477 16 17C16 17.5523 15.5523 18 15 18L8 18V19C8 19.5523 7.55229 20 7 20C6.44772 20 6 19.5523 6 19V18H1C0.447715 18 0 17.5523 0 17C0 16.4477 0.447715 16 1 16H6V15C6 14.4477 6.44772 14 7 14ZM14 9.5C14 8.94772 13.5523 8.5 13 8.5C12.4477 8.5 12 8.94772 12 9.5V10.5H1C0.447715 10.5 0 10.9477 0 11.5C0 12.0523 0.447715 12.5 1 12.5H12V13.5C12 14.0523 12.4477 14.5 13 14.5C13.5523 14.5 14 14.0523 14 13.5V12.5H15C15.5523 12.5 16 12.0523 16 11.5C16 10.9477 15.5523 10.5 15 10.5H14V9.5Z"
      />
    </svg>
  );
}
