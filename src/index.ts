import { toConfig, createPage } from "roam-client";

const CONFIG = toConfig("discourse-graph");
createPage({ title: CONFIG });
