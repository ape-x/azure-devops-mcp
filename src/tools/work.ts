// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { TreeStructureGroup } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import * as azdev from "azure-devops-node-api";
import { IRequestHandler } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces.js";
import { packageVersion } from "../version.js";
import { userAgent } from "../utils.js";
import { DefaultAzureCredential } from "@azure/identity";

const WORK_TOOLS = { 
  list_team_iterations: "work_list_team_iterations",
  create_iterations: "work_create_iterations",
  assign_iterations: "work_assign_iterations",
};

let orgUrl = "";
let adoPat = "";

async function getAzureDevOpsToken(): Promise<AccessToken> {
  process.env.AZURE_TOKEN_CREDENTIALS = "dev";
  const credential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
  const token = await credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
  return token;
}

async function getAzureDevOpsClient(): Promise<azdev.WebApi> {
  let authHandler: IRequestHandler;
  if (adoPat) {
    // Use PAT authentication
    authHandler = azdev.getPersonalAccessTokenHandler(adoPat);
  } else {
    // Use existing Azure Identity authentication
    const token = await getAzureDevOpsToken();
    authHandler = azdev.getBearerHandler(token.token);
  }
  const connection = new azdev.WebApi(orgUrl, authHandler, undefined, {
    productName: "AzureDevOps.MCP",
    productVersion: packageVersion,
    userAgent: userAgent
  });
  return connection;
}

function configureWorkTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>,
  _adoPat: string,
  _orgUrl: string
) {  

  adoPat = _adoPat;
  orgUrl = _orgUrl;

  server.tool(
    WORK_TOOLS.list_team_iterations,
    "Retrieve a list of iterations for a specific team in a project.",     
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().describe("The name or ID of the Azure DevOps team."),
      timeframe: z.enum(["current"]).optional().describe("The timeframe for which to retrieve iterations. Currently, only 'current' is supported."),
    },
    async ({ project, team, timeframe }) => {
      try {
        const connection = await getAzureDevOpsClient();
        const workApi = await connection.getWorkApi();
        const iterations = await workApi.getTeamIterations(
          { project, team },
          timeframe
        );

        if (!iterations) {
          return { content: [{ type: "text", text: "No iterations found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(iterations, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return { 
          content: [{ type: "text", text: `Error fetching team iterations: ${errorMessage}` }], 
          isError: true
        };
      }
    }
  );

  server.tool(
    WORK_TOOLS.create_iterations,
    "Create new iterations in a specified Azure DevOps project.",     
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      iterations: z.array(z.object({
        iterationName: z.string().describe("The name of the iteration to create."),
        startDate: z.string().optional().describe("The start date of the iteration in ISO format (e.g., '2023-01-01T00:00:00Z'). Optional."),
        finishDate: z.string().optional().describe("The finish date of the iteration in ISO format (e.g., '2023-01-31T23:59:59Z'). Optional.")
      })).describe("An array of iterations to create. Each iteration must have a name and can optionally have start and finish dates in ISO format.")
    },
    async ({ project, iterations }) => {
      try {
        const connection = await getAzureDevOpsClient();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const results = [];

        for (const { iterationName, startDate, finishDate } of iterations) {
          // Step 1: Create the iteration
          const iteration = await workItemTrackingApi.createOrUpdateClassificationNode(
            {
              name: iterationName,
              attributes: {
                startDate: startDate ? new Date(startDate) : undefined,
                finishDate: finishDate ? new Date(finishDate) : undefined,
              },
            },
            project,
            TreeStructureGroup.Iterations
          );
          
          if (iteration) {
            results.push(iteration);
          }
        }
        
        if (results.length === 0) {
          return { content: [{ type: "text", text: "No iterations were created" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return { 
          content: [{ type: "text", text: `Error creating iterations: ${errorMessage}` }], 
          isError: true
        };
      }
    }
  );
  
  server.tool(
    WORK_TOOLS.assign_iterations,
    "Assign existing iterations to a specific team in a project.",  
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().describe("The name or ID of the Azure DevOps team."),
      iterations: z.array(z.object({
        identifier: z.string().describe("The identifier of the iteration to assign."),
        path: z.string().describe("The path of the iteration to assign, e.g., 'Project/Iteration'.")
      })).describe("An array of iterations to assign. Each iteration must have an identifier and a path."),
    },
    async ({ project, team, iterations }) => {
      try {
        const connection = await getAzureDevOpsClient();
        const workApi = await connection.getWorkApi();
        const teamContext = { project, team };
        const results = [];
        
        for (const { identifier, path } of iterations) {
          const assignment = await workApi.postTeamIteration(
            { path: path, id: identifier },
            teamContext
          );

          if (assignment) {
            results.push(assignment);
          }
        }
        
        if (results.length === 0) {
          return { content: [{ type: "text", text: "No iterations were assigned to the team" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return { 
          content: [{ type: "text", text: `Error assigning iterations: ${errorMessage}` }], 
          isError: true
        };
      }
    }
  );
 
}

export { WORK_TOOLS, configureWorkTools };
