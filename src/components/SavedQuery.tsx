import { InputGroup, Button, Tooltip } from "@blueprintjs/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import createPage from "roamjs-components/writes/createPage";
import updateBlock from "roamjs-components/writes/updateBlock";
import { Result } from "../util";
import { render as exportRender } from "../ExportDialog";
import getQBClauses from "../utils/getQBClauses";
import getSubTree from "roamjs-components/util/getSubTree";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";

type QueryBuilderResults = Parameters<
  typeof window.roamjs.extension.queryBuilder.ResultsView
>[0]["results"];

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
  isSavedToPage?: boolean;
  resultsReferenced: Set<string>;
  clearOnClick: (s: string) => void;
  setResultsReferenced: (s: Set<string>) => void;
  editSavedQuery: (s: string) => void;
  initialResults?: QueryBuilderResults;
}) => {
  const [results, setResults] = useState<QueryBuilderResults>(
    initialResults || []
  );
  const resultFilter = useCallback(
    (r: Result) => !resultsReferenced.has(r.text),
    [resultsReferenced]
  );
  const [minimized, setMinimized] = useState(!isSavedToPage && !initialResults);
  const [initialQuery, setInitialQuery] = useState(!!initialResults);
  const [label, setLabel] = useState(() => getTextByBlockUid(uid));
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [error, setError] = useState("");
  const { ResultsView, fireQuery, parseQuery } =
    window.roamjs.extension.queryBuilder;
  useEffect(() => {
    if (!initialQuery && !minimized) {
      setInitialQuery(true);
      fireQuery(parseQuery(uid))
        .then(setResults)
        .catch(() => {
          setError(
            `Query failed to run. Try running a new query from the editor.`
          );
        });
    }
  }, [initialQuery, minimized, setInitialQuery, setResults, uid]);
  const resultsInViewRef = useRef([]);
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
        parentUid={uid}
        header={
          error ? (
            <div className="text-red-700 mb-4">{error}</div>
          ) : (
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
                <Tooltip content={"Edit"}>
                  <Button
                    icon={"edit"}
                    onClick={() => {
                      const parentUid = getParentUidByBlockUid(uid);
                      const oldScratchUid = getSubTree({
                        key: "scratch",
                        parentUid,
                      }).uid;
                      (oldScratchUid
                        ? deleteBlock(oldScratchUid)
                        : Promise.resolve()
                      )
                        .then(() =>
                          createBlock({
                            parentUid: oldScratchUid,
                            node: { text: "scratch" },
                          })
                        )
                        .then((newUid) =>
                          Promise.all(
                            getShallowTreeByParentUid(uid).map((c, order) =>
                              window.roamAlphaAPI.moveBlock({
                                location: { "parent-uid": newUid, order },
                                block: { uid: c.uid },
                              })
                            )
                          )
                        )
                        .then(() => {
                          editSavedQuery(label);
                          onDelete?.();
                        });
                    }}
                    minimal
                  />
                </Tooltip>
                <Tooltip content={"Export Results"}>
                  <Button
                    icon={"export"}
                    minimal
                    onClick={() => {
                      (results.length
                        ? Promise.resolve(results)
                        : fireQuery(parseQuery(uid))
                      ).then((records) => {
                        const cons = getQBClauses(
                          parseQuery(uid).conditions
                        ).map((c) => ({
                          predicate: {
                            text: c.target,
                            uid: getPageUidByPageTitle(c.target),
                          },
                          relation: c.relation,
                        }));
                        exportRender({
                          fromQuery: {
                            nodes: records.concat(
                              cons
                                .map((c) => c.predicate)
                                .filter((c) => !!c.uid)
                            ),
                          },
                        });
                      });
                    }}
                  />
                </Tooltip>
                {!isSavedToPage && (
                  <>
                    <Tooltip content={"Insert Results"}>
                      <Button
                        icon={"insert"}
                        minimal
                        onClick={() => {
                          resultsInViewRef.current.map((r) => {
                            clearOnClick?.(r.text);
                          });
                          setResultsReferenced(
                            new Set([
                              ...Array.from(resultsReferenced),
                              ...resultsInViewRef.current.map((r) => r.text),
                            ])
                          );
                        }}
                      />
                    </Tooltip>
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
                                  block: {
                                    uid: getSubTree({
                                      key: "scratch",
                                      parentUid: uid,
                                    }).uid,
                                  },
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
          )
        }
        resultFilter={resultFilter}
        hideResults={minimized}
        results={results.map(({ id, ...a }) => a)}
        preventSavingSettings
        preventExport
        ctrlClick={(r) => {
          setResultsReferenced(
            new Set([...Array.from(resultsReferenced), r.text])
          );
          clearOnClick?.(r.text);
        }}
        onResultsInViewChange={(r) => (resultsInViewRef.current = r)}
      />
    </div>
  );
};

export default SavedQuery;
