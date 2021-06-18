import * as os from "os";
import * as edgedb from "edgedb";

import {schemaQuery} from "../renderer/state/models/schema/query";
import {
  SchemaGraphNodeType,
  SchemaGraphNodeObject,
  NodePosition,
} from "../renderer/schemaGraph/interfaces";
import {generateSchamaGraphNodesAndLinks} from "../renderer/schemaGraph/utils";
import {layoutObjectNodes} from "../renderer/schemaGraph/webcolaLayout";
import {layoutAndRouteLinks} from "../renderer/schemaGraph/linkLayout";

const username = os.userInfo().username.toLowerCase();

const selectedDatabases = process.argv[2]?.split(",");

const options = {
  host: "localhost",
  user: username,
};

const failingDBs: string[] = [];

(async function main() {
  let databaseNames = selectedDatabases ?? [];

  if (!databaseNames.length) {
    let conn;
    try {
      conn = await edgedb.connect(options);
      databaseNames = await conn.query(
        "SELECT (SELECT sys::Database FILTER NOT .builtin).name"
      );
    } catch (e) {
      console.error(e);
    } finally {
      await conn?.close();
    }
  }

  let i = 1;
  for (const dbName of databaseNames) {
    console.log(`\n(${i++} of ${databaseNames.length})`);
    await testLayout(dbName);
  }

  console.log(`\n\n --- Total failing schemas: ${failingDBs.length} ---`);
  if (failingDBs.length) {
    console.log(failingDBs.join());
  }
})();

async function testLayout(dbName: string) {
  console.log(`Database:  ${dbName}`);
  let conn, schemaData;
  try {
    conn = await edgedb.connect({...options, database: dbName});
    schemaData = await conn.query(schemaQuery);
  } catch (e) {
    console.error(e);
  } finally {
    await conn?.close();
  }

  if (schemaData?.length) {
    try {
      const {nodes, links} = generateSchamaGraphNodesAndLinks(schemaData);

      if (!nodes.length) {
        console.log("  No nodes");
        return;
      }

      const objectNodes = nodes.filter(
        (node) => node.type === SchemaGraphNodeType.object
      ) as SchemaGraphNodeObject[];

      console.time("Layout object nodes");
      const layoutedNodes = await layoutObjectNodes(objectNodes, links);
      console.timeEnd("Layout object nodes");

      const nodePositions = layoutedNodes.reduce<{
        [key: string]: NodePosition;
      }>((positions, nodePos) => {
        positions[nodePos.id] = nodePos;
        return positions;
      }, {});

      const {errors} = layoutAndRouteLinks(objectNodes, links, nodePositions);

      if (!errors.length) {
        console.log("  Layout successful");
      } else {
        failingDBs.push(dbName);
        console.log(`  ${errors.length} links failed to layout`);
        errors.forEach((error) => console.log(error));
      }
    } catch (e) {
      console.error(e);
      failingDBs.push(dbName);
    }
  } else {
    console.log("  No schema data");
  }
}
