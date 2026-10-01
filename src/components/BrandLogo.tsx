import Image from "next/image";

/** Approved moon-and-neighbor mark; live text keeps the wordmark crisp and accessible. */
export default function BrandLogo({ stacked = false }: { stacked?: boolean }) {
  return <span className={stacked ? "flex flex-col items-center gap-5" : "inline-flex items-center gap-2.5"}>
    <Image src="/brand/wolgye-symbol.svg" alt="" width={stacked ? 104 : 34} height={stacked ? 104 : 34} priority />
    <span className={stacked ? "text-3xl font-extrabold tracking-tighter text-[#202124]" : "whitespace-nowrap text-xl font-extrabold tracking-tight text-[#202124]"}>WOLINK<span className="brand-tagline ml-2 text-[11px] font-medium tracking-normal text-[#747a80]">재능 나눔</span></span>
  </span>;
}
