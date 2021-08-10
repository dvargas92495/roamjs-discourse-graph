import {
  Button,
  Card,
  Classes,
  H3,
  IconName,
  Label,
  Switch,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createBlock,
  deleteBlock,
  getFirstChildTextByBlockUid,
  getPageUidByPageTitle,
  getRoamUrl,
  getShallowTreeByParentUid,
  openBlockInSidebar,
} from "roam-client";
import {
  createComponentRender,
  MenuItemSelect,
  PageInput,
  setInputSetting,
  toFlexRegex,
} from "roamjs-components";
import {
  getNodes,
  getRelations,
  getRelationLabels,
  triplesToQuery,
} from "./util";
import { render as exportRender } from "./ExportDialog";

type Condition = {
  relation: string;
  predicate: string;
  that: boolean;
  uid: string;
};

const QueryCondition = ({
  con,
  setConditions,
  conditions,
  relationLabels,
}: {
  con: Condition;
  setConditions: (cons: Condition[]) => void;
  conditions: Condition[];
  relationLabels: string[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = containerRef.current.querySelector<HTMLSpanElement>(
      ".roamjs-page-input-target"
    );
    if (target) {
      target.style.width = "100%";
      const parentStyle = target.parentElement.style;
      parentStyle.width = "100%";
      parentStyle.display = "inline-block";
    }
  }, [containerRef]);
  return (
    <div
      style={{ display: "flex", margin: "8px 0", alignItems: "baseline" }}
      ref={containerRef}
    >
      <Switch
        labelElement={
          <span style={{ minWidth: 36, width: 36, display: "inline-block" }}>
            {con.that ? "That" : "Not"}
          </span>
        }
        checked={con.that}
        onChange={(e) => {
          const checked = (e.target as HTMLInputElement).checked;
          setInputSetting({
            blockUid: con.uid,
            key: "That",
            value: `${checked}`,
          });
          setConditions(
            conditions.map((c) =>
              c.uid === con.uid ? { ...con, that: checked } : c
            )
          );
        }}
      />
      <MenuItemSelect
        activeItem={con.relation}
        onItemSelect={(relation) => {
          setInputSetting({
            blockUid: con.uid,
            key: "Relation",
            value: relation,
            index: 1,
          });
          setConditions(
            conditions.map((c) =>
              c.uid === con.uid ? { ...con, relation } : c
            )
          );
        }}
        items={relationLabels}
        emptyValueText={"Choose relationship"}
        ButtonProps={{
          style: {
            minWidth: 180,
            width: 180,
            margin: "0 8px",
            display: "flex",
            justifyContent: "space-between",
          },
        }}
      />
      <div style={{ flexGrow: 1 }}>
        <PageInput
          value={con.predicate}
          setValue={(value) => {
            setInputSetting({
              blockUid: con.uid,
              value,
              key: "Predicate",
              index: 2,
            });
            setConditions(
              conditions.map((c) =>
                c.uid === con.uid ? { ...con, predicate: value } : c
              )
            );
          }}
        />
      </div>
      <Button
        icon={"trash"}
        onClick={() => {
          deleteBlock(con.uid);
          setConditions(conditions.filter((c) => c.uid !== con.uid));
        }}
        minimal
        style={{ alignSelf: "end" }}
      />
    </div>
  );
};

const SynthesisQuery = ({
  blockUid,
  clearResultIcon = { name: "cross" },
}: {
  blockUid: string;
  clearResultIcon?: { name: IconName; onClick?: (t: string) => void };
}) => {
  const NODE_LABELS = useMemo(getNodes, []);
  const relations = useMemo(getRelations, []);
  const items = useMemo(() => NODE_LABELS.map((nl) => nl.text), NODE_LABELS);
  const NODE_LABEL_ABBR_BY_TEXT = useMemo(
    () => Object.fromEntries(NODE_LABELS.map(({ text, abbr }) => [text, abbr])),
    [NODE_LABELS]
  );
  const tree = useMemo(() => getShallowTreeByParentUid(blockUid), [blockUid]);
  const [activeMatch, setActiveMatch] = useState(
    getFirstChildTextByBlockUid(
      tree.find((t) => toFlexRegex("match").test(t.text))?.uid || ""
    )
  );
  const [conditions, setConditions] = useState<Condition[]>(() => {
    const parentUid = tree.find((t) =>
      toFlexRegex("conditions").test(t.text)
    )?.uid;
    if (!parentUid) {
      return [];
    }
    return getShallowTreeByParentUid(parentUid).map(({ uid }) => {
      const fields = getShallowTreeByParentUid(uid);
      const getVal = (key: string) =>
        getFirstChildTextByBlockUid(
          fields.find((t) => toFlexRegex(key).test(t.text))?.uid
        );
      return {
        uid,
        that: getVal("that") !== "false",
        relation: getVal("relation"),
        predicate: getVal("predicate"),
      };
    });
  });
  const [showResults, setShowResults] = useState(false);
  const [pinned, setPinned] = useState(
    tree.find((t) => toFlexRegex("pinned").test(t.text))?.uid
  );
  const [clearedResults, setClearedResults] = useState(
    pinned
      ? new Set(getShallowTreeByParentUid(pinned).map((t) => t.text))
      : new Set()
  );
  const [initialLoad, setInitialLoad] = useState(true);
  const [results, setResults] = useState<{ text: string; uid: string }[]>([]);
  const filteredResults = useMemo(
    () => results.filter((r) => !clearedResults.has(r.uid)),
    [results, clearedResults]
  );
  const fireQuery = useCallback(() => {
    const makeQuery = (node: string, condition: string) =>
      `[:find ?node-title ?node-uid :where [?${node} :node/title ?node-title] [?${node} :block/uid ?node-uid] ${condition}]`;
    try {
      const separateQueryResults = conditions.map(
        ({ relation, predicate, that }) =>
          relations
            .filter((r) => [r.label, r.complement].includes(relation))
            .map(({ triples, source, destination, label, complement }) => {
              const queryTriples = triples.map((t) => t.slice(0));
              const sourceTriple = queryTriples.find((t) => t[2] === source);
              const destinationTriple = queryTriples.find(
                (t) => t[2] === destination
              );
              let nodeVar;
              if (label === relation) {
                nodeVar = sourceTriple[0];
                destinationTriple[1] = "Has Title";
                destinationTriple[2] = predicate;
              } else if (complement === relation) {
                nodeVar = destinationTriple[0];
                sourceTriple[1] = "Has Title";
                sourceTriple[2] = predicate;
              }
              const subQuery = triplesToQuery(queryTriples);
              const condition = that
                ? subQuery
                : `[?${nodeVar} :block/refs ?node-ref] [?node-ref :node/title "${NODE_LABEL_ABBR_BY_TEXT[activeMatch]}"] (not ${subQuery})`;
              const nodesOnPage = window.roamAlphaAPI.q(
                makeQuery(nodeVar, condition)
              );
              return new Set(nodesOnPage.map((t) => JSON.stringify(t)));
            })
            .reduce((all, cur) => {
              cur.forEach((c) => all.add(c));
              return all;
            }, new Set())
      );
      const results = Array.from(
        separateQueryResults.reduce(
          (prev, cur) => new Set([...prev].filter((p) => cur.has(p))),
          new Set(separateQueryResults.flatMap((r) => Array.from(r)))
        )
      )
        .map((s) => JSON.parse(s))
        .map((t) => ({ text: t[0], uid: t[1] }));
      setResults(results);
    } catch (e) {
      console.error("Error from Roam:");
      console.error(e.message);
      setResults([]);
    }
    setShowResults(true);
  }, [setShowResults, setResults, relations, conditions, activeMatch]);
  useEffect(() => {
    if (initialLoad && pinned) {
      fireQuery();
    }
    setInitialLoad(false);
  }, [pinned, setInitialLoad, initialLoad, fireQuery]);
  const relationLabels = useMemo(
    () => getRelationLabels(relations),
    [relations]
  );
  return (
    <Card>
      <H3>Synthesis</H3>
      <Label>
        Match
        <MenuItemSelect
          activeItem={activeMatch}
          onItemSelect={(value) => {
            setActiveMatch(value);
            setInputSetting({ blockUid, value, key: "match" });
          }}
          items={items}
          emptyValueText={"Choose node type"}
        />
      </Label>
      {conditions.map((con) => (
        <QueryCondition
          key={con.uid}
          relationLabels={relationLabels}
          con={con}
          conditions={conditions}
          setConditions={setConditions}
        />
      ))}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button
          rightIcon={"plus"}
          text={"Add Condition"}
          onClick={() => {
            const parentUid =
              getShallowTreeByParentUid(blockUid).find((t) =>
                toFlexRegex("conditions").test(t.text)
              )?.uid ||
              createBlock({
                parentUid: blockUid,
                node: { text: "Conditions" },
                order: 1,
              });
            const uid = createBlock({
              parentUid,
              order: conditions.length,
              node: {
                text: `${conditions.length}`,
                children: [{ text: "That", children: [{ text: "true" }] }],
              },
            });
            setConditions([
              ...conditions,
              { uid, that: true, relation: "", predicate: "" },
            ]);
          }}
        />
        <Button
          text={"Query"}
          onClick={() => {
            fireQuery();
            setClearedResults(new Set());
          }}
          intent={"primary"}
          disabled={
            !conditions.length ||
            !conditions.every((c) => !!c.relation && !!c.predicate) ||
            !activeMatch
          }
        />
      </div>
      {showResults && (
        <>
          <hr />
          <H3 style={{ display: "flex", justifyContent: "space-between" }}>
            Results
            <div>
              <Button
                icon={"export"}
                minimal
                onClick={() =>
                  exportRender({
                    fromQuery: {
                      results: filteredResults.map(({ text, uid }) => ({
                        title: text,
                        uid,
                      })),
                      conditions: conditions.map((c) => ({
                        predicate: {
                          title: c.predicate,
                          uid: getPageUidByPageTitle(c.predicate),
                        },
                        relation: c.relation,
                      })),
                    },
                  })
                }
              />
              <Button
                icon={"pin"}
                onClick={() => {
                  if (pinned) {
                    deleteBlock(pinned);
                    setPinned("");
                    setClearedResults(new Set());
                  } else {
                    setPinned(
                      createBlock({
                        node: { text: "pinned" },
                        parentUid: blockUid,
                        order: 2,
                      })
                    );
                  }
                }}
                minimal
                active={!!pinned}
              />
              <Button
                icon={"cross"}
                onClick={() => {
                  setShowResults(false);
                  setResults([]);
                }}
                minimal
              />
            </div>
          </H3>
          {filteredResults.length ? (
            <>
              <i style={{ opacity: 0.8 }}>
                Found {filteredResults.length} results
              </i>
              <ul>
                {filteredResults.map((r) => (
                  <li key={r.uid}>
                    <span
                      style={{
                        display: "flex",
                        width: "100%",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <a
                        className={"rm-page-ref"}
                        href={getRoamUrl(r.uid)}
                        onClick={(e) => {
                          if (e.ctrlKey || e.shiftKey) {
                            openBlockInSidebar(r.uid);
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                      >
                        {r.text}
                      </a>
                      {pinned && (
                        <Button
                          icon={clearResultIcon.name}
                          minimal
                          onClick={() => {
                            createBlock({
                              parentUid: pinned,
                              node: { text: r.uid },
                              order: clearedResults.size,
                            });
                            setClearedResults(
                              new Set([...clearedResults, r.uid])
                            );
                            clearResultIcon.onClick?.(r.text);
                          }}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div>No Results</div>
          )}
        </>
      )}
    </Card>
  );
};

export const render = createComponentRender(SynthesisQuery);

export default SynthesisQuery;
