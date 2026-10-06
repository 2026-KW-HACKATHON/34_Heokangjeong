import type { SVGProps } from "react";

const paths = {
  store: "M4 3h16l2 6H2ZM2 9v2a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2V9M4 14v7h16v-7M9 21v-6h6v6M8 3 7 9m9-6 1 6",
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16",
  plus: "M12 4v16M4 12h16",
  chat: "M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 1 1 19 0ZM7 10h10M7 14h6",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3",
  trophy: "M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v6m-4 0h8",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  back: "m14 5-7 7 7 7",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6",
  pen: "m15 3 6 6-11 11-7 1 1-7ZM12 6l6 6",
  camera: "M3 6h4l2-3h6l2 3h4v15H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  megaphone: "M3 10v4h4l9 4V6L7 10Zm4 4 2 7h4l-2-6",
  web: "M2 4h20v16H2ZM2 9h20m-13 3-3 3 3 3m6-6 3 3-3 3",
  phone: "M6 2h12v20H6ZM10 18h4",
  folder: "M3 6h7l2 3h9v12H3ZM3 6V3h7l2 3h9v3",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
} as const;
export type IconName = keyof typeof paths;
export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
