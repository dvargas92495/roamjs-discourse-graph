import { Button, Card, Classes, H3, Label, Switch } from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import {
  createBlock,
  deleteBlock,
  getFirstChildTextByBlockUid,
  getRoamUrl,
  getShallowTreeByParentUid,
  updateBlock,
} from "roam-client";
import {
  createComponentRender,
  MenuItemSelect,
  PageInput,
  setInputSetting,
  toFlexRegex,
} from "roamjs-components";
import { NODE_LABELS, NODE_LABEL_ABBR_BY_TEXT } from "./util";

const RELATION_LABELS = [
  { text: "Informs" },
  { text: "Supports" },
  { text: "Opposes" },
];

const SynthesisQuery = ({ blockUid }: { blockUid: string }) => {
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
  const [results, setResults] = useState<{ text: string; uid: string }[]>([]);
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
          items={NODE_LABELS.map((nl) => nl.text)}
          emptyValueText={"Choose node type"}
        />
      </Label>
      {conditions.map((con) => (
        <div
          style={{ display: "flex", margin: "8px 0", alignItems: "baseline" }}
          key={con.uid}
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
            items={RELATION_LABELS.map((rl) => rl.text)}
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
          onClick={() => {
            const matchQueryPart = `[?p :node/title ?pt] [?p :block/uid ?pu] [?p :block/refs ?n] [?n :node/title "${NODE_LABEL_ABBR_BY_TEXT[activeMatch]}"]`;
            const conditionQueries = conditions
              .map(({ relation, predicate, that, uid }) => {
                const prefix = uid.replace(/[\d_-]/g, "");
                if (relation === "Informs") {
                  const relate = `[?${prefix}-b :block/refs ?p] [?${prefix}-pred :node/title "${predicate}"] [?${prefix}-b :block/page ?${prefix}-pred]`;
                  return that ? relate : `(not ${relate})`;
                } else if (relation === "Supports") {
                  const relate = `[?${prefix}-bpred :block/refs ?${prefix}-pred] [?${prefix}-bs :block/refs ?${prefix}-s] [?${prefix}-s :node/title "Supported By"] [?${prefix}-b :block/refs ?p] [?${prefix}-pred :node/title "${predicate}"] [?${prefix}-b :block/parents ?${prefix}-bs] [?${prefix}-b :block/parents ?${prefix}-bs]`;
                  return that ? relate : `(not ${relate})`;
                } else if (relation === "Opposes") {
                  const relate = `[?${prefix}-bpred :block/refs ?${prefix}-pred] [?${prefix}-bs :block/refs ?${prefix}-s] [?${prefix}-s :node/title "Opposed By"] [?${prefix}-b :block/refs ?p] [?${prefix}-pred :node/title "${predicate}"] [?${prefix}-b :block/parents ?${prefix}-bs] [?${prefix}-b :block/parents ?${prefix}-bs]`;
                  return that ? relate : `(not ${relate})`;
                }
              })
              .join(" ");
            const query = `[:find ?pt ?pu :where ${matchQueryPart} ${conditionQueries}]`;
            try {
              const nodesOnPage = window.roamAlphaAPI.q(query);
              const results = Array.from(
                new Set(nodesOnPage.map((t) => JSON.stringify(t)))
              )
                .map((s) => JSON.parse(s))
                .map((t) => ({ text: t[0], uid: t[1] }));
              setResults(results);
            } catch (e) {
              console.error("Error thrown from following query:");
              console.error(query);
              console.error("Error from Roam:");
              console.error(e.message);
              setResults([]);
            }
            setShowResults(true);
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
            <Button
              icon={"cross"}
              onClick={() => {
                setShowResults(false);
                setResults([]);
              }}
              minimal
            />
          </H3>
          {results.length ? (
            <>
              <i style={{ opacity: 0.8 }}>Found {results.length} results</i>
              <ul>
                {results.map((r) => (
                  <li key={r.uid}>
                    <a href={getRoamUrl(r.uid)}>{r.text}</a>
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
