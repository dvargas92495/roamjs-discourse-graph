import { Button, Card, Classes, H3, Label, Switch } from "@blueprintjs/core";
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
  getRoamUrl,
  getShallowTreeByParentUid,
  openBlockInSidebar,
  updateBlock,
} from "roam-client";
import {
  createComponentRender,
  MenuItemSelect,
  PageInput,
  setInputSetting,
  toFlexRegex,
} from "roamjs-components";
import { getNodes, getRelations, triplesToQuery } from "./util";

const SynthesisQuery = ({ blockUid }: { blockUid: string }) => {
  const NODE_LABELS = useMemo(getNodes, []);
  const relations = useMemo(getRelations, []);
  const items = useMemo(() => NODE_LABELS.map((nl) => nl.text), NODE_LABELS);
  const NODE_LABEL_ABBR_BY_TEXT = useMemo(
    () => Object.fromEntries(NODE_LABELS.map(({ text, abbr }) => [text, abbr])),
    [NODE_LABELS]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => getShallowTreeByParentUid(blockUid), [blockUid]);
  const [activeMatch, setActiveMatch] = useState(
    getFirstChildTextByBlockUid(
      tree.find((t) => toFlexRegex("match").test(t.text))?.uid || ""
    )
  );
  const [conditions, setConditions] = useState<
    { relation: string; predicate: string; that: boolean; uid: string }[]
  >(() => {
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
  const [initialLoad, setInitialLoad] = useState(true);
  const [results, setResults] = useState<{ text: string; uid: string }[]>([]);
  const fireQuery = useCallback(() => {
    const makeQuery = (source: string, condition: string) =>
      `[:find ?source-title ?source-uid :where [?${source} :node/title ?source-title] [?${source} :block/uid ?source-uid] [?${source} :block/refs ?source-ref] [?source-ref :node/title "${NODE_LABEL_ABBR_BY_TEXT[activeMatch]}"] ${condition}]`;
    try {
      const separateQueryResults = conditions.map(
        ({ relation, predicate, that }) => {
          const { triples, source, destination } = relations.find(
            (r) => r.label === relation
          );
          const queryTriples = triples.map((t) => t.slice(0));
          const sourceTriple = queryTriples.find((t) => t[2] === source);
          const destinationTriple = queryTriples.find(
            (t) => t[2] === destination
          );
          destinationTriple[1] = "Has Title";
          destinationTriple[2] = predicate;
          const subQuery = triplesToQuery(queryTriples);
          const condition = that ? subQuery : `(not ${subQuery})`;
          const nodesOnPage = window.roamAlphaAPI.q(
            makeQuery(sourceTriple[0], condition)
          );
          return new Set(nodesOnPage.map((t) => JSON.stringify(t)));
        }
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
    const target = containerRef.current.querySelector<HTMLSpanElement>(
      ".roamjs-page-input-target"
    );
    if (target) {
      target.style.width = "100%";
      const parentStyle = target.parentElement.style;
      parentStyle.width = "100%";
      parentStyle.display = "inline-block";
    }
  }, [pinned, setInitialLoad, initialLoad, fireQuery, containerRef]);
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
        <div
          style={{ display: "flex", margin: "8px 0", alignItems: "baseline" }}
          key={con.uid}
          ref={containerRef}
        >
          <Switch
            labelElement={
              <span
                style={{ minWidth: 36, width: 36, display: "inline-block" }}
              >
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
            items={relations.map((rl) => rl.label)}
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
          onClick={fireQuery}
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
                icon={"pin"}
                onClick={() => {
                  if (pinned) {
                    deleteBlock(pinned);
                    setPinned("");
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
          {results.length ? (
            <>
              <i style={{ opacity: 0.8 }}>Found {results.length} results</i>
              <ul>
                {results.map((r) => (
                  <li key={r.uid}>
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
