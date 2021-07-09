import { Card, H3 } from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { getRoamUrl, openBlockInSidebar } from "roam-client";
import { NODE_ABBRS, query } from "./util";

type Props = { title: string };

const ContextContent = ({ title }: Props) => {
  const informs = useMemo(
    () =>
      Object.fromEntries(
        query(
          `[:find ?grt ?gu ?gt :where [?p :node/title "${title}"] [?b :block/refs ?p] [?b :block/page ?g] [?g :node/title ?gt] [?g :block/uid ?gu] [?g :block/refs ?gr] [?gr :node/title ?grt]]`
        )
          .filter(([node]) => NODE_ABBRS.has(node as string))
          .map((a) => a.slice(1) as string[])
      ),
    []
  );
  const supports = useMemo(
    () =>
      Object.fromEntries(
        query(
          `[:find ?grt ?gu ?gt :where [?p :node/title "${title}"] [?b :block/refs ?p] [?s :block/children ?b] [?s :block/refs ?sr] [?sr :node/title "Supported By"] [?bg :block/children ?s] [?bg :block/refs ?g] [?g :node/title ?gt] [?g :block/uid ?gu] [?g :block/refs ?gr] [?gr :node/title ?grt]]`
        )
          .filter(([node]) => NODE_ABBRS.has(node as string))
          .map((a) => a.slice(1) as string[])
      ),
    []
  );
  const opposes = useMemo(
    () =>
      Object.fromEntries(
        query(
          `[:find ?grt ?gu ?gt :where [?p :node/title "${title}"] [?b :block/refs ?p] [?s :block/children ?b] [?s :block/refs ?sr] [?sr :node/title "Opposed By"] [?bg :block/children ?s] [?bg :block/refs ?g] [?g :node/title ?gt] [?g :block/uid ?gu] [?g :block/refs ?gr] [?gr :node/title ?grt]]`
        )
          .filter(([node]) => NODE_ABBRS.has(node as string))
          .map((a) => a.slice(1) as string[])
      ),
    []
  );
  const renderItems = (blocks: Record<string, string>, label: string) =>
    Object.entries(blocks).map(([uid, title]) => (
      <li key={uid} style={{margin: '2px 0'}}>
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
  return (
    <ul style={{ listStyleType: "none" }}>
      {renderItems(informs, "Informs")}
      {renderItems(supports, "Supports")}
      {renderItems(opposes, "Opposes")}
    </ul>
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
