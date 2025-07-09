// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";

import { configureCoreTools } from "./tools/core.js";
import { configureWorkTools } from "./tools/work.js";
import { configureBuildTools } from "./tools/builds.js";
import { configureRepoTools } from "./tools/repos.js";
import { configureWorkItemTools } from "./tools/workitems.js";
import { configureReleaseTools } from "./tools/releases.js";
import { configureWikiTools } from "./tools/wiki.js";
import { configureTestPlanTools } from "./tools/testplans.js";
import { configureSearchTools } from "./tools/search.js";

function configureAllTools(
  server: McpServer,
) {
    configureCoreTools(server);
    configureWorkTools(server);
    configureBuildTools(server);
    configureRepoTools(server);
    configureWorkItemTools(server);
    configureReleaseTools(server);
    configureWikiTools(server);
    configureTestPlanTools(server);
    configureSearchTools(server);
}

export { configureAllTools };