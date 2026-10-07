"use client";

import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";
import type { Post } from "@/types";

export default class MapErrorBoundary extends Component<{
  children: ReactNode;
  posts: Post[];
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Map rendering failed", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="h-full overflow-y-auto bg-[var(--bg)] p-4">
        <div className="card">
          <h2 className="font-bold">지도를 불러오지 못했어요</h2>
          <p className="sub mt-2 text-sm">공고 위치는 아래 목록에서 계속 확인할 수 있어요.</p>
          <button type="button" className="btn btn-ghost mt-4" onClick={() => this.setState({ failed: false })}>지도 다시 불러오기</button>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {this.props.posts.map((post) => (
            <li key={post.id}>
              <Link href={`/posts/detail?id=${post.id}`} className="card block">
                <p className="font-semibold">{post.title}</p>
                <p className="sub mt-1 text-xs">{post.category} · {post.address}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}
