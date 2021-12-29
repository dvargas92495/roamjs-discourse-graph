import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { getDiscourseContextResults } from "./util";

type Props = {
  title: string;
  results?: ReturnType<typeof getDiscourseContextResults>;
};

export const ContextContent = ({ title, results }: Props) => {
  const queryResults = useMemo(
    () => results || getDiscourseContextResults(title),
    [title, results]
  );
  const renderItems = (blocks: Record<string, string>, label: string) =>
    Object.entries(blocks).map(([uid, title]) => (
      <li key={`${label}-${uid}`} style={{ margin: "2px 0" }}>
        <b>{label}: </b>
        <span
          className={"roamjs-discourse-context-title"}
          onClick={(e) =>
            e.shiftKey
              ? openBlockInSidebar(uid)
              : window.location.assign(getRoamUrl(uid))
          }
        >
          {title}
        </span>
      </li>
    ));
  return queryResults.length ? (
    <ul style={{ listStyleType: "none" }}>
      {queryResults.flatMap(({ label, results }) =>
        renderItems(results, label)
      )}
    </ul>
  ) : (
    <div>No discourse relations found.</div>
  );
};

const DiscourseContext = ({ title }: Props) => {
  const [caretShown, setCaretShown] = useState(false);
  const [caretOpen, setCaretOpen] = useState(false);
  return (
    <>
      <div
        className={"flex-h-box"}
        onMouseEnter={() => setCaretShown(true)}
        onMouseLeave={() => setCaretShown(false)}
        style={{ marginBottom: 4 }}
      >
        <span
          className={`bp3-icon-standard bp3-icon-caret-down rm-caret ${
            caretOpen ? "rm-caret-open" : "rm-caret-closed"
          } ${
            caretShown ? "rm-caret-showing" : "rm-caret-hidden"
          } dont-focus-block`}
          onClick={() => setCaretOpen(!caretOpen)}
        />
        <div style={{ flex: "0 1 2px" }} />
        <div style={{ color: "rgb(206, 217, 224)" }}>
          <strong>Discourse Context</strong>
        </div>
      </div>
      {caretOpen && <ContextContent title={title} />}
    </>
  );
};

export const render = ({ p, ...props }: { p: HTMLDivElement } & Props) =>
  ReactDOM.render(<DiscourseContext {...props} />, p);

export default DiscourseContext;
