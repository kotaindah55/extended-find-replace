import { getLastChangelog } from "./utils.mjs";
import { readFileSync, appendFileSync } from "fs";

let { changelog, version } = await getLastChangelog(),
	manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

if (version !== manifest.version)
	throw Error("Manifest version doesn't match with the changelog!");

appendFileSync("CHANGELOG.md", changelog);