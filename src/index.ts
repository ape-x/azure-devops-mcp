#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as azdev from "azure-devops-node-api";
import { IRequestHandler } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces.js";
import { AccessToken, DefaultAzureCredential } from "@azure/identity";
import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { userAgent } from "./utils.js";
import { packageVersion } from "./version.js";
const args = process.argv.slice(2);
if (args.length === 0) {  console.error(
    "Usage: mcp-server-azuredevops <organization_name> <ado_pat>"
  );
  process.exit(1);
}

export const orgName = args[0];
export const adoPat = args[1];
export const debug = args.includes("--debug");

const orgUrl = "https://dev.azure.com/" + orgName;

export async function getAzureDevOpsToken(): Promise<AccessToken> {
  process.env.AZURE_TOKEN_CREDENTIALS = "dev";
  const credential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
  const token = await credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
  return token;
}

export async function getAzureDevOpsClient(): Promise<azdev.WebApi> {
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

async function testAzureDevOpsConnection(): Promise<void> {
  try {
    console.log("Testing Azure DevOps connection...");
    const client = await getAzureDevOpsClient();
    
    // Make the most basic call - get organization info
    const coreApi = await client.getCoreApi();
    const projects = await coreApi.getProjects();
    
    console.log(`✅ Connection successful! Found ${projects.length} projects in organization: ${orgName}`);
    if (projects.length > 0) {
      console.log(`First project: ${projects[0].name}`);
    }
  } catch (error) {
    console.error("❌ Connection failed:", error);
    throw error;
  }
}

async function testWorkItems(): Promise<void>{
  try {
    console.log("Testing Azure DevOps work items...");
    const client = await getAzureDevOpsClient();
    const workItemTrackingApi = await client.getWorkApi();
    
    // Create a TeamContext object - you need project and team
    const teamContext = {
      project: "ALBA", // Replace with actual project name
      team: "ALBA Team"        // Replace with actual team name, or omit for default team
    };
    
    const iterations = await workItemTrackingApi.getTeamIterations(teamContext);
    console.log(`✅ Found ${iterations.length} team iterations.`);
    
    // Optionally log the first iteration name
    if (iterations.length > 0) {
      console.log(`First iteration: ${iterations[0].name}`);
    }
  } catch (error) {
    console.error("❌ Work items test failed:", error);
    throw error;
  }
}

async function main() {
  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
  });

  // Test connection before starting server
  if (debug) {
    //await testAzureDevOpsConnection();
    await testWorkItems();
  } 



  configurePrompts(server);
  
  configureAllTools(
    server,
  );

  const transport = new StdioServerTransport();
  console.log("Azure DevOps MCP Server version : " + packageVersion);
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
