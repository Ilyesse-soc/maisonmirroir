const fs = require("node:fs/promises");
async function main() {
  const url =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Jost:wght@400&display=swap";
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36" },
  });
  if (!r.ok) throw Error("Font stylesheet unavailable");
  const css = await r.text();
  let blocks = [...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)];
  if (!blocks.length) blocks = [...css.matchAll(/(@font-face\s*\{[^}]+\})/g)];
  await fs.mkdir("public/launch/fonts", { recursive: true });
  let local = "";
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i][1],
      remote = block.match(/url\(([^)]+)\)/)[1],
      name = `font-${i}.${remote.endsWith(".ttf") ? "ttf" : "woff2"}`;
    const data = await fetch(remote);
    if (!data.ok) throw Error("Font download failed");
    await fs.writeFile(
      `public/launch/fonts/${name}`,
      Buffer.from(await data.arrayBuffer()),
    );
    local += block.replace(remote, `/launch/fonts/${name}`) + "\n";
  }
  if (!blocks.length) throw Error("No Latin fonts found");
  await fs.writeFile("app/launch-fonts.css", local);
  for (const family of ["cormorantgaramond", "jost"]) {
    const license = await fetch(
      `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`,
    );
    if (!license.ok) throw Error("License unavailable");
    await fs.writeFile(
      `public/launch/fonts/${family}-OFL.txt`,
      await license.text(),
    );
  }
  console.log(
    `Downloaded ${blocks.length} Latin font faces from Google Fonts.`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
