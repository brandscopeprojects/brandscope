// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HqAgentMessageView, type HqAgentMessage } from "@/components/hq-agent/hq-agent-message";

function assistant(content: string): HqAgentMessage {
  return { id: "m1", role: "assistant", content, streaming: false };
}

describe("HqAgentMessageView safe markdown", () => {
  it("renders GFM markdown (bold, table) as real elements", () => {
    const { container } = render(
      <HqAgentMessageView
        message={assistant("**Bold answer**\n\n| Plan | MRR |\n| --- | --- |\n| pro | 100 |")}
        onReact={() => {}}
      />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("Bold answer");
    expect(container.querySelector("table")).not.toBeNull();
    expect(screen.getByText("pro")).toBeInTheDocument();
  });

  it("does NOT inject raw HTML from model content (no script/img executed)", () => {
    const { container } = render(
      <HqAgentMessageView
        message={assistant('Hello <script>window.__pwned=1</script><img src=x onerror="window.__pwned=1">')}
        onReact={() => {}}
      />,
    );
    // Raw HTML must be treated as text, never as live DOM nodes.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
});
