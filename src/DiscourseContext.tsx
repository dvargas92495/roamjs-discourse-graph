import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { getRoamUrl, openBlockInSidebar } from "roam-client";
import {
  englishToDatalog,
  freeVar,
  getNodes,
  getRelations,
  matchNode,
  triplesToQuery,
} from "./util";

type Props = { title: string };

const ContextContent = ({ title }: Props) => {
  const nodes = useMemo(getNodes, []);
  const nodeType = useMemo(
    () => nodes.find(({ format }) => matchNode({ format, title }))?.type,
    [title, nodes]
  );
  const relations = useMemo(getRelations, []);
  const queryResults = useMemo(() => {
    try {
      const rawResults = [
        ...relations
          .filter((r) => r.source === nodeType)
          .map((r) => ({
            r,
            destinationTriple: r.triples.find(
              (t) => t[2] === "destination" || t[2] === r.destination
            ),
            sourceTriple: r.triples.find(
              (t) => t[2] === "source" || t[2] === r.source
            ),
          }))
          .filter(
            ({ sourceTriple, destinationTriple }) =>
              !!sourceTriple && !!destinationTriple
          )
          .map(({ r, destinationTriple, sourceTriple }) => {
            const lastPlaceholder = freeVar(destinationTriple[0]);
            return {
              label: r.label,
              results: Object.fromEntries(
                window.roamAlphaAPI.q(
                  `[:find ?u ?t :where [${lastPlaceholder} :block/uid ?u] [${lastPlaceholder} :node/title ?t] ${triplesToQuery(
                    [
                      [sourceTriple[0], "Has Title", title],
                      [
                        destinationTriple[0],
                        destinationTriple[1],
                        r.destination,
                      ],
                      ...r.triples.filter(
                        (t) => t !== sourceTriple && t !== destinationTriple
                      ),
                    ],
                    englishToDatalog(nodes)
                  )}]`
                ) as [string, string][]
              ),
            };
          }),
        ...relations
          .filter((r) => r.destination === nodeType)
          .map((r) => ({
            r,
            sourceTriple: r.triples.find(
              (t) => t[2] === "source" || t[2] === r.source
            ),
            destinationTriple: r.triples.find(
              (t) => t[2] === "destination" || t[2] === r.destination
            ),
          }))
          .filter(
            ({ sourceTriple, destinationTriple }) =>
              !!sourceTriple && !!destinationTriple
          )
          .map(({ r, sourceTriple, destinationTriple }) => {
            const firstPlaceholder = freeVar(sourceTriple[0]);
            return {
              label: r.complement,
              results: Object.fromEntries(
                window.roamAlphaAPI.q(
                  `[:find ?u ?t :where [${firstPlaceholder} :block/uid ?u] [${firstPlaceholder} :node/title ?t] ${triplesToQuery(
                    [
                      [destinationTriple[0], "Has Title", title],
                      [sourceTriple[0], sourceTriple[1], r.source],
                      ...r.triples.filter(
                        (t) => t !== destinationTriple && t !== sourceTriple
                      ),
                    ],
                    englishToDatalog(nodes)
                  )}]`
                ) as [string, string][]
              ),
            };
          }),
      ];
      const groupedResults = Object.fromEntries(
        rawResults.map((r) => [r.label, {} as Record<string, string>])
      );
      rawResults.forEach((r) =>
        Object.entries(r.results).forEach(
          ([k, v]) => (groupedResults[r.label][k] = v)
        )
      );
      return Object.entries(groupedResults).map(([label, results]) => ({
        label,
        results,
      }));
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
