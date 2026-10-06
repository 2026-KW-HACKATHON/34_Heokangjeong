import Image from "next/image";

/** A connected W monogram with a crisp, accessible wordmark. */
export default function BrandLogo({ stacked = false }: { stacked?: boolean }) {
  return <span className={stacked ? "flex flex-col items-center gap-5" : "inline-flex items-center gap-2.5"}>
    <Image src="/brand/wolink-w.svg?v=2" alt="" width={stacked ? 104 : 38} height={stacked ? 104 : 38} priority />
    <span className={stacked ? "text-3xl font-extrabold tracking-tighter text-[#202124]" : "whitespace-nowrap text-xl font-extrabold tracking-tight text-[#202124]"}>WOLINK<span className="brand-tagline ml-2 text-[11px] font-medium tracking-normal text-[#747a80]">재능 나눔</span></span>
  </span>;
}
