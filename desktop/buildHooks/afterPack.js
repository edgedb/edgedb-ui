const https = require("https");
const path = require("path");
const fs = require("fs");

const z = require("zod");

const CLIVersion = "1.0.0-beta.1";

const baseUrl = "https://packages.edgedb.com";

const platforms = new Map([
  ["linux", "linux-x86_64"],
  ["darwin", "macos-x86_64"],
  ["win32", "win-x86_64"],
]);

const jsonIndexSchema = z.object({
  packages: z.array(
    z.object({
      basename: z.string(),
      slot: z.string().nullable(),
      name: z.string(),
      version: z.string(),
      revision: z.string(),
      architecture: z.string(),
      installref: z.string(),
    })
  ),
});

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, {headers: {"User-Agent": "EdgeDB Studio Build"}}, (res) => {
        if (res.statusCode !== 200) {
          reject(`Got status code ${res.statusCode} while fetching ${url}`);
        }
        if (!/^application\/json/.test(res.headers["content-type"])) {
          reject(
            `Expected content-type 'application/json', got '${res.headers["content-type"]}'`
          );
        }

        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function downloadFile(url, path, fileOpts) {
  return new Promise((resolve, reject) => {
    https
      .get(url, {headers: {"User-Agent": "EdgeDB Studio Build"}}, (res) => {
        if (res.statusCode !== 200) {
          reject(`Got status code ${res.statusCode} while fetching ${url}`);
        }

        const fileSize = res.headers["content-length"]
          ? parseInt(res.headers["content-length"], 10)
          : -1;

        const fileWriteStream = fs.createWriteStream(path, fileOpts);

        let lastLogTimestamp = Date.now();

        res.on("data", (data) => {
          fileWriteStream.write(data);
          if (lastLogTimestamp + 1000 < Date.now()) {
            if (fileSize !== -1) {
              console.log(
                `${((fileWriteStream.bytesWritten / fileSize) * 100).toFixed(
                  2
                )}%`
              );
            } else {
              console.log(`${fileWriteStream.bytesWritten} bytes`);
            }
            lastLogTimestamp = Date.now();
          }
        });
        res.on("end", () => {
          fileWriteStream.end();
        });
        res.on("error", reject);

        fileWriteStream.on("finish", () => resolve());
        fileWriteStream.on("error", reject);
      })
      .on("error", reject);
  });
}

async function fetchCLIDownloadUrl(platform) {
  const indexUrl = `${baseUrl}/archive/.jsonindexes/${platform}.json`;
  const jsonIndex = await fetchJSON(indexUrl);

  const indexData = jsonIndexSchema.parse(jsonIndex);

  const pkgData = indexData.packages.filter(
    (pkg) => pkg.name === "edgedb-cli" && pkg.version.startsWith(CLIVersion)
  );

  if (pkgData.length !== 1) {
    throw new Error(
      `${
        !pkgData.length
          ? "Could not find"
          : `Found ${pkgData.length} revisions for`
      } edgedb-cli package for platform: ${platform}, version: ${CLIVersion}`
    );
  }

  return `${baseUrl}${pkgData[0].installref}`;
}

exports.default = async function (context) {
  const downloadUrl = await fetchCLIDownloadUrl(
    platforms.get(context.electronPlatformName)
  );

  const cliPath = path.join(context.appOutDir, "resources", "edgedb-cli");

  console.log(
    `Downloading edgedb-cli from '${downloadUrl}' into '${cliPath}' ...`
  );

  await downloadFile(downloadUrl, cliPath, {mode: 0o755});
};
