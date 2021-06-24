import { Button, Card, Classes, H3, Label } from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import {
  getFirstChildTextByBlockUid,
  getShallowTreeByParentUid,
} from "roam-client";
import {
  createComponentRender,
  MenuItemSelect,
  PageInput,
  setInputSetting,
  toFlexRegex,
} from "roamjs-components";
import { NODE_LABELS } from "./util";

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
  const [activeRelation, setActiveRelation] = useState(
    getFirstChildTextByBlockUid(
      tree.find((t) => toFlexRegex("relation").test(t.text))?.uid || ""
    )
  );
  const [activePredicate, setActivePredicate] = useState(
    getFirstChildTextByBlockUid(
      tree.find((t) => toFlexRegex("predicate").test(t.text))?.uid || ""
    )
  );
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState([]);
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
      <Label>
        That
        <MenuItemSelect
          activeItem={activeRelation}
          onItemSelect={(value) => {
            setActiveRelation(value);
            setInputSetting({ blockUid, value, key: "relation", index: 1 });
          }}
          items={RELATION_LABELS.map((rl) => rl.text)}
          emptyValueText={"Choose relationship"}
        />
      </Label>
      <Label>
        This
        <PageInput
          value={activePredicate}
          setValue={(value) => {
            setActivePredicate(value);
            setInputSetting({ blockUid, value, key: "predicate", index: 2 });
          }}
        />
      </Label>
      <div>
        <Button
          text={"Query"}
          onClick={() => {
            setShowResults(true);
          }}
          intent={"primary"}
          disabled={!activePredicate || !activeRelation || !activeMatch}
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
            <ul>
              {results.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
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
