import React from "react";

type Props = {
  className?: string;
};

const Logo = ({className}: Props) => {
  return (
    <svg
      width="60"
      height="35"
      viewBox="0 0 60 35"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d={
          `
          M50.8198 16.9141C50.8198 21.0547 49.1597 21.7969 47.3042
          21.7969H43.3589V12.0313H47.3042C49.1597 12.0313 50.8198 12.7734
          50.8198 16.9141ZM48.8086 16.9141C48.8086 14.0234 47.9297 13.8867
          46.6602 13.8867H45.4297V19.9414H46.6602C47.9297 19.9414 48.8086
          19.8047 48.8086 16.9141ZM27.9102
          21.7969V12.0313H34.1211V13.8867H29.9805V15.8789H33.1055V17.` +
          `7148H29.9805V19.9414H34.1211V21.7969H27.9102ZM37.5
          34.0908H39.5455V0H37.5V34.0908ZM54.9609
          17.4609V19.9414H56.6797C57.7539 19.9414 58.0273 19.2383 58.0273
          18.7109C58.0273 18.3008 57.832 17.4609 56.3672
          17.4609H54.9609ZM54.9609 13.8867V15.7422H56.3672C57.168 15.7422
          57.6367 15.3906 57.6367 14.8047C57.6367 14.2188 57.168 13.8867
          56.3672 13.8867H54.9609ZM52.8906 12.0313H56.875C58.9648 12.0313
          59.5898 13.4961 59.5898 14.5508C59.5898 15.5273 58.9648 16.2305
          58.5352 16.4258C59.7852 17.0312 60 18.2617 60 18.8867C60 19.707
          59.5898 21.7969 56.875 21.7969H52.8906V12.0313ZM16.0161
          16.9141C16.0161 21.0547 14.3559 21.7969 12.5005
          21.7969H8.55518V12.0313H12.5005C14.3559 12.0313 16.0161 12.7734
          16.0161 16.9141ZM22.1094 20.0195C23.1641 20.0195 23.7109 19.668
          23.9062 19.4336V18.3594H22.2266V16.6797H25.5664V20.5664C25.2734
          21.0156 23.6719 21.8945 22.207 21.8945C19.8047 21.8945 17.7734 20.957
          17.7734 16.8164C17.7734 12.6758 19.8242 11.9336 21.6797
          11.9336C24.5898 11.9336 25.3125 13.457 25.5469 14.8047L23.8281
          15.1953C23.7305 14.5703 23.1836 13.7891 21.9336 13.7891C20.6641
          13.7891 19.7852 13.9258 19.7852 16.8164C19.7852 19.707 20.7031
          20.0195 22.1094 20.0195ZM14.0039 16.9141C14.0039 14.0234 13.125
          13.8867 11.8555 13.8867H10.625V19.9414H11.8555C13.125 19.9414
          14.0039 19.8047 14.0039 16.9141ZM0 21.7969V12.0313H6.21092V13.` +
          `8867H2.07031V15.8789H5.1953V17.7148H2.07031V19.9414H6.21092V21` +
          `.7969H0Z`
        }
      />
    </svg>
  );
};

export default Logo;