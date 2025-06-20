/// <reference lib="deno.ns" />

const command = new Deno.Command("git", {
  args: ["rev-parse", "--short", "HEAD"],
  stdout: "piped",
  stderr: "piped",
});

const { stdout } = await command.output();
const commit = new TextDecoder().decode(stdout).trim();

const versionFilePath = "./dist/public_verion.ts";
const versionContent = `export const publicVersion = "${commit}";`;

await Deno.writeTextFile(versionFilePath, versionContent);
console.log(`Updated public_version.ts with version information: ${commit}`);