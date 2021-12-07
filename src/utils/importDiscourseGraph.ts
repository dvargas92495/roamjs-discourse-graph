import type {
  InputTextNode,
} from "roamjs-components/types";
import createPage from "roamjs-components/writes/createPage";

const importDiscourseGraph = ({
  title,
  grammar,
  nodes,
  relations,
}: {
  title: string;
  grammar: { source: string; label: string; destination: string }[];
  nodes: {
    uid: string;
    title: string;
    children: InputTextNode[];
    date: string;
    createdBy: string;
  }[];
  relations: { source: string; label: string; target: string }[];
}) => {
  const pagesByUids = Object.fromEntries(
    nodes.map(({ uid, title }) => [uid, title])
  );
  createPage({
    title,
    tree: relations.map(({ source, target, label }) => ({
      text: `[[${pagesByUids[source]}]]`,
      children: [
        {
          text: label,
          children: [
            {
              text: `[[${pagesByUids[target]}]]`,
            },
          ],
        },
      ],
    })),
  });
  nodes.forEach((node: { title: string; children: InputTextNode[] }) =>
    createPage({ title: node.title, tree: node.children })
  );
  console.log(grammar);
};

export default importDiscourseGraph;
