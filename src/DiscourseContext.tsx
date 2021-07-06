import { Card, H3 } from "@blueprintjs/core";
import React, { useMemo } from "react";
import ReactDOM from "react-dom";
import { NODE_ABBRS } from "./util";

type Props = { title: string };
const DiscourseContext = ({ title }: Props) => {
  const informs = useMemo(
    () =>
      Object.fromEntries(
        window.roamAlphaAPI
          .q(
            `[:find ?grt ?gu ?gt :where [?p :node/title "${title}"] [?b :block/refs ?p] [?b :block/page ?g] [?g :node/title ?gt] [?g :block/uid ?gu] [?g :block/refs ?gr] [?gr :node/title ?grt]]`
          )
          .filter(([node]) => NODE_ABBRS.has(node))
          .map((a) => a.slice(1))
      ),
    []
  );
  return (
    <Card>
      <H3>Discourse Context</H3>
      <ul style={{ listStyleType: "none" }}>
        {Object.entries(informs).map(([uid, title]) => (
          <li key={uid}>
            <b>Informs: </b>
            <span>{title}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export const render = ({ p, ...props }: { p: HTMLDivElement } & Props) =>
  ReactDOM.render(<DiscourseContext {...props} />, p);

export default DiscourseContext;
