import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const allowedElements: string[] = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
];

export function MarkdownMessage({ body }: { body: string }) {
  return (
    <div className="markdown-message">
      <Markdown
        allowedElements={[...allowedElements]}
        components={{
          a({ children, href }) {
            if (!isSafeHttpUrl(href)) {
              return <span>{children}</span>;
            }

            return (
              <a href={href} rel="noopener noreferrer" target="_blank">
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return <blockquote>{children}</blockquote>;
          },
          code({ children, className }) {
            return <code className={className}>{children}</code>;
          },
          ol({ children }) {
            return <ol>{children}</ol>;
          },
          p({ children }) {
            return <p>{children}</p>;
          },
          pre({ children }) {
            return <pre>{children}</pre>;
          },
          ul({ children }) {
            return <ul>{children}</ul>;
          },
        }}
        remarkPlugins={[remarkGfm]}
        skipHtml
        unwrapDisallowed
        urlTransform={(url) => (isSafeHttpUrl(url) ? url : "")}
      >
        {body}
      </Markdown>
    </div>
  );
}

function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
