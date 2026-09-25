import Image from "next/image";

/** Approved moon-and-neighbor mark; live text keeps the wordmark crisp and accessible. */
export default function BrandLogo({ stacked = false }: { stacked?: boolean }) {
  return <span className={stacked ? "flex flex-col items-center gap-5" : "inline-flex items-center gap-2.5"}>
    <Image src="/brand/wolgye-symbol.svg" alt="" width={stacked ? 104 : 34} height={stacked ? 104 : 34} priority />
    <span className={stacked ? "text-3xl font-extrabold tracking-tighter text-[#202124]" : "whitespace-nowrap text-lg font-extrabold tracking-tight text-[#202124]"}>월계 재능나눔</span>
  </span>;
}
