import { InputGroup, Button, Tooltip, Icon } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useSubTree from "roamjs-components/hooks/useSubTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import createPage from "roamjs-components/writes/createPage";
import updateBlock from "roamjs-components/writes/updateBlock";
import { Result } from "../util";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import ResultsView, { Result as SearchResult } from "./ResultsView";
import { render as exportRender } from "../ExportDialog";

const SavedQuery = ({
  uid,
  isSavedToPage = false,
  onDelete,
  resultsReferenced,
  clearOnClick,
  setResultsReferenced,
  editSavedQuery,
  initialResults,
}: {
  uid: string;
  onDelete?: () => void;
  isSavedToPage?: boolean
  resultsReferenced: Set<string>;
  clearOnClick: (s: string, t: string) => void;
  setResultsReferenced: (s: Set<string>) => void;
  editSavedQuery: (s: string[]) => void;
  initialResults?: SearchResult[];
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), []);
  const queryNode = useSubTree({ tree, key: "query" });
  const query = useMemo(
    () => queryNode.children.map((t) => t.text),
    [queryNode]
  );
  const [results, setResults] = useState<SearchResult[]>(initialResults || []);
  const resultFilter = useCallback(
    (r: Result) => !resultsReferenced.has(r.text),
    [resultsReferenced]
  );
  const [minimized, setMinimized] = useState(!isSavedToPage && !initialResults);
  const [initialQuery, setInitialQuery] = useState(!!initialResults);
  const [label, setLabel] = useState(() => getTextByBlockUid(uid));
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const { returnNode, conditionNodes, selectionNodes } = useMemo(
    () => parseQuery(query),
    [parseQuery, query]
  );
  useEffect(() => {
    if (!initialQuery && !minimized) {
      setInitialQuery(true);
      const results = fireQuery({
        returnNode,
        conditions: conditionNodes,
        selections: selectionNodes,
      });
      setResults(results);
    }
  }, [initialQuery, minimized, setInitialQuery, setResults, parseQuery]);
  return (
    <div
      style={{
        border: "1px solid gray",
        borderRadius: 4,
        padding: 4,
        margin: 4,
      }}
    >
      <ResultsView
        header={
          <>
            {isEditingLabel ? (
              <InputGroup
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateBlock({ uid, text: label });
                    setIsEditingLabel(false);
                  }
                }}
                autoFocus
                rightElement={
                  <Button
                    minimal
                    icon={"confirm"}
                    onClick={() => {
                      updateBlock({ uid, text: label });
                      setIsEditingLabel(false);
                    }}
                  />
                }
              />
            ) : (
              <span tabIndex={-1} onClick={() => setIsEditingLabel(true)}>
                {label}
              </span>
            )}
            <div>
              <Tooltip content={"Export Results"}>
                <Button
                  icon={"export"}
                  minimal
                  onClick={() => {
                    const conditions = parseQuery(query).conditionNodes.map(
                      (c) => ({
                        predicate: {
                          title: c.target,
                          uid: getPageUidByPageTitle(c.target),
                        },
                        relation: c.relation,
                      })
                    );
                    exportRender({
                      fromQuery: {
                        nodes: results
                          .map(({ text, uid }) => ({
                            title: text,
                            uid,
                          }))
                          .concat(
                            conditions
                              .map((c) => c.predicate)
                              .filter((c) => !!c.uid)
                          ),
                      },
                    });
                  }}
                />
              </Tooltip>
              {!isSavedToPage && (
                <>
                  <Tooltip content={"Save Query to Page"}>
                    <Button
                      icon={"page-layout"}
                      minimal
                      onClick={() => {
                        createPage({
                          title: `discourse-graph/queries/${label}`,
                        })
                          .then((pageUid) =>
                            window.roamAlphaAPI
                              .moveBlock({
                                block: { uid: queryNode.uid },
                                location: { "parent-uid": pageUid, order: 0 },
                              })
                              .then(() =>
                                window.roamAlphaAPI.ui.mainWindow.openPage({
                                  page: { uid: pageUid },
                                })
                              )
                          )
                          .then(onDelete);
                      }}
                    />
                  </Tooltip>
                  <Tooltip content={minimized ? "Maximize" : "Minimize"}>
                    <Button
                      icon={minimized ? "maximize" : "minimize"}
                      onClick={() => setMinimized(!minimized)}
                      active={minimized}
                      minimal
                    />
                  </Tooltip>
                  <Tooltip content={"Delete"}>
                    <Button icon={"cross"} onClick={onDelete} minimal />
                  </Tooltip>
                </>
              )}
            </div>
          </>
        }
        hideResults={minimized}
        results={results.map(({ id, ...a }) => a)}
        resultFilter={resultFilter}
        ResultIcon={({ result: r }) => (
          <Button
            icon={"hand-right"}
            minimal
            onClick={() => {
              setResultsReferenced(
                new Set([...Array.from(resultsReferenced), r.text])
              );
              clearOnClick?.(r.text, returnNode);
            }}
          />
        )}
        resultContent={
          <div style={{ fontSize: 10, position: "relative" }}>
            <Button
              icon={<Icon icon={"edit"} iconSize={12} />}
              minimal
              style={{
                height: 12,
                width: 12,
                minHeight: 12,
                minWidth: 12,
                padding: 2,
                position: "absolute",
                top: 0,
                right: 8,
              }}
              onClick={() => {
                editSavedQuery(query);
                onDelete?.();
              }}
            />
            {query.map((q, i) => (
              <p key={i} style={{ margin: 0 }}>
                {q}
              </p>
            ))}
          </div>
        }
      />
    </div>
  );
};

export default SavedQuery;
