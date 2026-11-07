// Runs the real functions against an in-memory database. Used by `npm test` and GitHub Actions.
import fs from "fs"; import os from "os"; import path from "path"; import assert from "assert";
import { pathToFileURL } from "url";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fn-"));
for (const f of fs.readdirSync("netlify/functions")) {
  fs.writeFileSync(path.join(dir, f), fs.readFileSync("netlify/functions/" + f, "utf8").replace('"@netlify/blobs"', '"./blobs.mjs"'));
}
fs.writeFileSync(path.join(dir, "blobs.mjs"), `const all={};export const getStore=(n)=>{const m=all[n]??={};return{get:async k=>m[k]??null,setJSON:async(k,v)=>{m[k]=JSON.parse(JSON.stringify(v))},delete:async k=>{delete m[k]}}};`);
process.env.ADMIN_PASSWORD = "invite"; process.env.SUPER_ADMIN_EMAIL = "boss@x.com";
const load = async (n) => (await import(pathToFileURL(path.join(dir, n)).href)).default;
const auth = await load("auth.mjs"), sup = await load("super.mjs"), menu = await load("menu.mjs");
const post = (f, h, b) => f(new Request("http://x/", { method: "POST", headers: h, body: JSON.stringify(b) }));
const reg = async (e) => { const r = await post(auth, {}, { action: "register", email: e, password: "password1", code: "invite" }); return [r.status, await r.json()]; };

const boss = await reg("boss@x.com"); assert.equal(boss[0], 200);
const toks = []; for (let i = 1; i <= 7; i++) { const r = await reg(`u${i}@x.com`); assert.equal(r[0], 200); toks.push(r[1].token); }
assert.equal((await reg("u8@x.com"))[0], 403, "8th admin must be refused");
assert.equal((await post(sup, { "x-session": toks[0] }, { action: "x" })).status, 403, "admin must not reach super");
assert.equal((await post(sup, { "x-session": boss[1].token }, { action: "disable", email: "u1@x.com" })).status, 200);
assert.equal((await post(menu, { "x-session": toks[0] }, {})).status, 401, "disabled user session must die");
assert.equal((await menu(new Request("http://x/", { method: "PUT", body: "[]" }))).status, 401, "anonymous save must fail");
const ok = await menu(new Request("http://x/", { method: "PUT", headers: { "x-session": toks[1] }, body: JSON.stringify([{ title: "T", price: 5, category: "food", subcategory: "A" }]) }));
assert.equal(ok.status, 200);
assert.equal((await (await menu(new Request("http://x/"))).json())[0].title, "T", "public menu must show saved item");
console.log("All tests passed");
