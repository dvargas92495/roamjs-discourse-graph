import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { getRoamUrl, openBlockInSidebar } from "roam-client";
import { freeVar, getNodes, getRelations, triplesToQuery } from "./util";

type Props = { title: string };

const ContextContent = ({ title }: Props) => {
  const NODE_ABBRS = useMemo(() => new Set(getNodes().map((t) => t.abbr)), []);
  const nodeType = useMemo(
    () =>
      window.roamAlphaAPI
        .q(
          `[:find ?t :where [?n :node/title ?t] [?p :block/refs ?n] [?p :node/title "${title}"]]`
        )
        .map((s) => s[0] as string)
        .find((s) => NODE_ABBRS.has(s)),
    [NODE_ABBRS, title]
  );
  const relations = useMemo(getRelations, []);
  const queryResults = useMemo(() => {
    try {
      return [
        ...relations
          .filter((r) => r.source === nodeType)
          .map((r) => {
            const lastPlaceholder = freeVar(
              r.triples.find((t) => t[2] === r.destination)[0]
            );
            const sourceTriple = r.triples.find((t) => t[2] === r.source);
            return {
              label: r.label,
              results: Object.fromEntries(
                window.roamAlphaAPI.q(
                  `[:find ?u ?t :where [${lastPlaceholder} :block/uid ?u] [${lastPlaceholder} :node/title ?t] ${triplesToQuery(
                    [
                      [sourceTriple[0], "Has Title", title],
                      ...r.triples.filter((t) => t[2] !== r.source),
                    ]
                  )}]`
                )
              ),
            };
          }),
        ...relations
          .filter((r) => r.destination === nodeType)
          .map((r) => {
            const firstPlaceholder = freeVar(
              r.triples.find((t) => t[2] === r.source)[0]
            );
            const destTriple = r.triples.find((t) => t[2] === r.destination);
            return {
              label: r.complement,
              results: Object.fromEntries(
                window.roamAlphaAPI.q(
                  `[:find ?u ?t :where [${firstPlaceholder} :block/uid ?u] [${firstPlaceholder} :node/title ?t] ${triplesToQuery(
                    [
                      ...r.triples.filter((t) => t[2] !== r.destination),
                      [destTriple[2], "Has Title", title],
                    ]
                  )}]`
                )
              ),
            };
          }),
      ];
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [relations, title, nodeType]);
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
  return (
    <ul style={{ listStyleType: "none" }}>
      {queryResults.flatMap(({ label, results }) =>
        renderItems(results, label)
      )}
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
