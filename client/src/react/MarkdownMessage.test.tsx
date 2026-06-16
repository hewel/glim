import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MarkdownMessage } from "./MarkdownMessage";

describe("MarkdownMessage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders common inline markdown", () => {
    render(<MarkdownMessage body="Use **bold**, _italic_, and `code`." />);

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
    expect(screen.getByText("code").tagName).toBe("CODE");
  });

  test("renders safe explicit links as external links", () => {
    render(<MarkdownMessage body="[site](https://example.com/docs)" />);

    const link = screen.getByRole("link", { name: "site" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("renders bare urls as safe external links", () => {
    render(<MarkdownMessage body="Visit https://example.com/docs today." />);

    const link = screen.getByRole("link", { name: "https://example.com/docs" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("does not render unsafe or non-web links as anchors", () => {
    render(
      <MarkdownMessage body="[bad](javascript:alert(1)) [mail](mailto:test@example.com)" />,
    );

    expect(screen.getByText("bad")).toBeVisible();
    expect(screen.getByText("mail")).toBeVisible();
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(screen.queryByRole("link", { name: "mail" })).toBeNull();
  });

  test("does not interpret raw html", () => {
    const { container } = render(<MarkdownMessage body="safe <strong>raw</strong>" />);

    expect(container).toHaveTextContent("safe raw");
    expect(document.querySelector("strong")).toBeNull();
  });

  test("renders fenced code blocks without syntax highlighting", () => {
    const { container } = render(<MarkdownMessage body={"```gleam\npub fn main() { Nil }\n```"} />);

    const pre = container.querySelector("pre");
    const code = container.querySelector("pre code");

    expect(pre).not.toBeNull();
    expect(code).not.toBeNull();
    expect(code).toHaveTextContent("pub fn main() { Nil }");
  });

  test("does not render excluded document or media elements", () => {
    const { container } = render(
      <MarkdownMessage
        body={[
          "# Heading",
          "",
          "![alt text](https://example.com/image.png)",
          "",
          "| a | b |",
          "| - | - |",
          "| 1 | 2 |",
          "",
          "- [x] done",
        ].join("\n")}
      />,
    );

    expect(container).toHaveTextContent("Heading");
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("input[type='checkbox']")).toBeNull();
  });
});
