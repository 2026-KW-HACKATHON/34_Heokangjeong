"use client";
import { useRef } from "react";

export default function IntroVideo() {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  function close() { dialog.current?.close(); }
  return <>
    <button ref={button} type="button" className="btn mt-6 w-full border border-[var(--line)] bg-white" onClick={() => dialog.current?.showModal()}>▶ 앱 소개 영상 보기</button>
    <dialog ref={dialog} aria-labelledby="intro-video-title" className="m-auto w-[calc(100%-32px)] max-w-lg rounded-2xl bg-white p-4 text-[var(--text)] backdrop:bg-black/60" onClick={e => { if(e.target === e.currentTarget) close(); }} onClose={() => { video.current?.pause(); button.current?.focus(); }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="intro-video-title" className="font-bold">WOLINK 앱 소개</h2>
        <button type="button" autoFocus onClick={close} className="rounded-lg px-3 py-2 text-sm" aria-label="소개 영상 닫기">닫기 ✕</button>
      </div>
      <video ref={video} controls playsInline preload="none" className="max-h-[65dvh] w-full rounded-xl bg-black" src="/videos/wolink-intro.mp4">이 브라우저에서는 영상을 재생할 수 없습니다.</video>
      <a href="https://www.youtube.com/watch?v=UfXsSFIvuE8" target="_blank" rel="noopener noreferrer" className="sub mt-3 block text-center text-xs underline">YouTube에서 보기 ↗</a>
    </dialog>
  </>;
}
