import runExtension from "roamjs-components/util/runExtension";
import addScriptAsDependency from "roamjs-components/dom/addScriptAsDependency";
import apiPost from "roamjs-components/util/apiPost";

export default runExtension({
  extensionId: "discourse-graph",
  run: async () => {
    apiPost({
      path: "graphs",
      data: {
        extension: "discourse-graph",
        graph: window.roamAlphaAPI.graph.name,
      },
    });

    if (process.env.NODE_ENV === "production") {
      addScriptAsDependency({
        id: "roamjs-query-builder-main",
        src: `https://roamjs.com/query-builder/main.js`,
        dataAttributes: { source: "discourse-graph" },
      });
    }
  },
});
