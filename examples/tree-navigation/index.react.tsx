import * as Ariakit from "@ariakit/react";
import type { MouseEvent } from "react";
import { useRef, useState } from "react";
import "./style.css";

const pages = [
  { id: "introduction", name: "Introduction", folderPath: [] },
  { id: "guides", name: "Guides", folderPath: [], folder: true },
  { id: "styling", name: "Styling", folderPath: ["guides"] },
  { id: "testing", name: "Testing", folderPath: ["guides"] },
  { id: "changelog", name: "Changelog", folderPath: [] },
];

export default function Example() {
  const [page, setPage] = useState("styling");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // After client-side navigation, move focus to the new page's heading. The
  // alternative is to keep focus in the tree and let aria-current carry the
  // change; both are accepted, but pick one and apply it consistently.
  const navigate = (id: string) => (event: MouseEvent) => {
    event.preventDefault();
    setPage(id);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const current = pages.find((item) => item.id === page);

  return (
    <div className="wrapper">
      <nav aria-label="Documentation" className="nav">
        <Ariakit.TreeProvider defaultExpandedIds={["guides"]}>
          <Ariakit.Tree aria-label="Documentation pages" className="tree">
            {pages.map((item) => (
              <Ariakit.TreeItem
                key={item.id}
                id={item.id}
                folder={item.folder}
                folderPath={item.folderPath}
                className="tree-item"
                aria-current={page === item.id ? "page" : undefined}
                render={<a href={`#${item.id}`} />}
                onClick={navigate(item.id)}
                label={item.name}
              />
            ))}
          </Ariakit.Tree>
        </Ariakit.TreeProvider>
      </nav>

      <main className="main">
        <h1 ref={headingRef} tabIndex={-1} className="heading">
          {current?.name}
        </h1>
        <p>This page stands in for the routed content.</p>
      </main>
    </div>
  );
}
