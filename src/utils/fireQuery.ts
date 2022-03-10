import {
  englishToDatalog,
  getDiscourseContextResults,
  getNodes,
  getRelations,
  matchNode,
  triplesToQuery,
} from "../util";
import { Condition, Selection } from "./types";
import type { Result as SearchResult } from "../components/ResultsView";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import { PullBlock } from "roamjs-components/types";

export const ANY_REGEX = /Has Any Relation To/i;

const predefinedSelections: {
  test: RegExp;
  text: string;
  mapper: (r: SearchResult & PullBlock, key: string) => SearchResult[string];
}[] = [
  {
    test: /created?\s*date/i,
    text: ":create/time",
    mapper: (r) => {
      const value = new Date(r[":create/time"]);
      delete r[":create/time"];
      return value;
    },
  },
  {
    test: /edit(ed)?\s*date/i,
    text: ":edit/time",
    mapper: (r) => {
      const value = new Date(r["edit/time"]);
      delete r["edit/time"];
      return value;
    },
  },
  {
    test: /author/i,
    text: ":create/user",
    mapper: (r) => {
      const value = window.roamAlphaAPI.pull(
        "[:user/display-name]",
        r[":create/user"][":db/id"]
      )[":user/display-name"];
      delete r.author;
      return value;
    },
  },
  {
    test: /^(.*)-(.*)$/,
    text: "",
    mapper: (r, key) => {
      const match = key.match(/^(.*)-(.*)$/);
      const rel = match?.[1] || "";
      const target = match?.[2] || "";
      const nodes = getNodes();
      const nodeTitleById = Object.fromEntries(
        nodes.map((n) => [n.type, n.text])
      );
      const results = getDiscourseContextResults(
        r.text,
        nodes,
        getRelations().filter(
          (r) =>
            (r.complement === rel && target === nodeTitleById[r.source]) ||
            (r.label === rel && target === nodeTitleById[r.destination])
        ),
        true
      );
      return Object.keys(results[0]?.results).length || 0;
    },
  },
  {
    test: /.*/,
    text: "",
    mapper: (r, key) => {
      return (
        window.roamAlphaAPI.q(
          `[:find (pull ?b [:block/string]) :where [?a :node/title "${normalizePageTitle(
            key
          )}"] [?p :block/uid "${
            r.uid
          }"] [?b :block/refs ?a] [?b :block/page ?p]]`
        )?.[0]?.[0]?.string || ""
      )
        .slice(key.length + 2)
        .trim();
    },
  },
];

const DEFAULT_SELECTIONS = [
  {
    mapper: (r: PullBlock & SearchResult, _: string): SearchResult[string] => {
      r.uid = r[":block/uid"];
      const value = r[":node/title"] || r[":block/string"];
      delete r[":block/uid"];
      delete r[":block/string"];
      delete r[":node/title"];
      return value;
    },
    pull: `:block/string\n:node/title\n:block/uid`,
    label: "text",
    key: "",
  },
];

const fireQuery = ({
  conditions,
  returnNode,
  selections,
}: {
  returnNode: string;
  conditions: Condition[];
  selections: Selection[];
}) => {
  const discourseRelations = getRelations();
  const discourseNodes = getNodes();
  const translator = englishToDatalog(discourseNodes);
  const nodeTypeByLabel = Object.fromEntries(
    discourseNodes.map((n) => [n.text.toLowerCase(), n.type])
  );
  const nodeLabelByType = Object.fromEntries(
    discourseNodes.map((n) => [n.type, n.text])
  );
  const nodeFormatByType = Object.fromEntries(
    discourseNodes.map((n) => [n.type, n.format])
  );
  const where = conditions
    .flatMap((c) => {
      const native = translator[c.relation];
      const targetType = nodeTypeByLabel[c.target.toLowerCase()];
      if (native) {
        if (/is a/.test(c.relation)) {
          return native(c.source, targetType);
        }
        const sourceType = nodeTypeByLabel[c.source.toLowerCase()];
        const prefix = sourceType
          ? translator["is a"](c.source, sourceType)
          : "";
        const suffix = targetType
          ? translator["is a"](c.target, targetType)
          : "";
        return `${prefix}${native(c.source, c.target)}${suffix}`;
      }
      const doesRelationMatchCondition = (
        relation: { source: string; destination: string },
        condition: { source: string; target: string }
      ) => {
        const sourceMatches =
          nodeLabelByType[relation.source] === condition.source;
        const targetMatches =
          relation.destination === nodeLabelByType[condition.target] ||
          matchNode({
            format: nodeFormatByType[relation.destination],
            title: condition.target,
          });
        if (sourceMatches) {
          return (
            targetMatches ||
            (!nodeTypeByLabel[condition.target.toLowerCase()] &&
              Object.values(nodeFormatByType).every(
                (format) => !matchNode({ format, title: condition.target })
              ))
          );
        }
        if (targetMatches) {
          return (
            sourceMatches || !nodeTypeByLabel[condition.source.toLowerCase()]
          );
        }
        return false;
      };
      const conditionTarget = targetType || c.target;
      const filteredRelations = discourseRelations
        .map((r) =>
          (r.label === c.relation || ANY_REGEX.test(c.relation)) &&
          doesRelationMatchCondition(r, c)
            ? { ...r, forward: true }
            : doesRelationMatchCondition(
                { source: r.destination, destination: r.source },
                c
              ) &&
              (r.complement === c.relation || ANY_REGEX.test(c.relation))
            ? { ...r, forward: false }
            : undefined
        )
        .filter((r) => !!r);
      if (!filteredRelations.length) return "";
      return `(or-join [?${c.source}] ${filteredRelations.map(
        ({ triples, source, destination, forward }) => {
          const queryTriples = triples.map((t) => t.slice(0));
          const sourceTriple = queryTriples.find((t) => t[2] === "source");
          const destinationTriple = queryTriples.find(
            (t) => t[2] === "destination"
          );
          if (!sourceTriple || !destinationTriple) return "";
          let sourceNodeVar = "";
          if (forward) {
            destinationTriple[1] = "Has Title";
            destinationTriple[2] = conditionTarget;
            sourceTriple[2] = source;
            sourceNodeVar = sourceTriple[0];
          } else {
            sourceTriple[1] = "Has Title";
            sourceTriple[2] = conditionTarget;
            destinationTriple[2] = destination;
            sourceNodeVar = destinationTriple[0];
          }
          const subQuery = triplesToQuery(queryTriples, translator);
          const andQuery = `\n  (and ${subQuery.replace(
            /([\s|\[]\?)/g,
            `$1${c.uid}-`
          )})`;
          return andQuery.replace(
            new RegExp(`\\?${c.uid}-${sourceNodeVar}`, "g"),
            `?${c.source}`
          );
        }
      )}\n)`;
    })
    .join("\n");

  const definedSelections = DEFAULT_SELECTIONS.concat(
    selections
      .map((s) => ({
        defined: predefinedSelections.find((p) => p.test.test(s.text)),
        s,
      }))
      .filter((p) => !!p.defined)
      .map((p) => ({
        mapper: p.defined.mapper,
        pull: p.defined.text,
        label: p.s.label || p.s.text,
        key: p.s.text,
      }))
  );
  const pullSelections = definedSelections.map((p) => p.pull).join("\n");
  const query = `[:find (pull ?${returnNode} [
    ${pullSelections}
]) :where ${where}]`;
  try {
    const results = where
      ? window.roamAlphaAPI.data.fast
          .q(query)
          .map((a) => JSON.parse(JSON.stringify(a[0])) as PullBlock)
      : [];
    return results.map(
      (r) =>
        definedSelections.reduce((p, c) => {
          p[c.label] = c.mapper(p, c.key);
          return p;
        }, r as SearchResult & PullBlock) as SearchResult
    );
  } catch (e) {
    console.error("Error from Roam:");
    console.error(e.message);
    console.error("Query from Roam:");
    console.error(query);
    return [];
  }
};

export default fireQuery;
