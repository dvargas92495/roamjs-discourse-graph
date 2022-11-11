import runExtension from "roamjs-components/util/runExtension";
import addScriptAsDependency from "roamjs-components/dom/addScriptAsDependency";
import apiPost from "roamjs-components/util/apiPost";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createBlock from "roamjs-components/writes/createBlock";
import { render as renderToast } from "roamjs-components/components/Toast";
import { render as renderSimpleAlert } from "roamjs-components/components/SimpleAlert";

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

    const pageUid = getPageUidByPageTitle("roam/js/discourse-graph");
    const configTree = getBasicTreeByParentUid(pageUid);
    const surveyed = getSubTree({ tree: configTree, key: "surveyed" });
    if (!surveyed.uid) {
      let dismissed = true;
      const closeSurvey = renderToast({
        position: "bottom-right",
        content: `👋 Greetings! 👋 

The discourse graph team is trying to understand how people are using the discourse graph extension, or not (as part of the larger research project it is a part of; context [here](https://twitter.com/JoelChan86/status/1570853004458491904?s=20&t=iAC5Tx3PYrMBhqCp9UAYOw)). 

Survey link is here: https://go.umd.edu/discourse-graph-survey

If you’ve explored/used the discourse graph extension in any capacity, we would be so grateful if you could take a few minutes to contribute to the survey!

Click on the ⏰ to dismiss and see this message later when you reload Roam.

Click on the ✖️ to dismiss for good (you won't see this message again).`,
        id: "discourse-survey",
        timeout: 0,
        onDismiss: () =>
          dismissed &&
          createBlock({ parentUid: pageUid, node: { text: "surveyed" } }),
        action: {
          text: "⏰",
          onClick: () => {
            dismissed = false;
            closeSurvey();
          },
        },
      });
    }

    if (window.roamjs.loaded.has("query-builder")) {
      renderSimpleAlert({
        content:
          "Warning! You must disable the Query Builder extension from Roam Depot in order to use the RoamJS Discourse Graph extension, as it comes with its own copy of Query Builder.\n\nDiscourse Graph will soon be a part of Query Builder once approved by Roam Depot.",
      });
    } else if (process.env.NODE_ENV === "production") {
      addScriptAsDependency({
        id: "roamjs-query-builder-main",
        src: `https://roamjs.com/query-builder/main.js`,
        dataAttributes: { source: "discourse-graph" },
      });
    }
  },
});
