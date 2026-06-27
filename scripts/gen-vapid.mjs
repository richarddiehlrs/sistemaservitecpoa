import fs from "fs";
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
const path = ".env.local";
let env = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const vars = {
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: "mailto:richard@servitecpoa.com.br",
};

for (const [name, val] of Object.entries(vars)) {
  const re = new RegExp(`^${name}=.*$`, "m");
  const line = `${name}=${val}`;
  if (re.test(env)) {
    env = env.replace(re, line);
  } else {
    if (!env.includes("# Web Push")) {
      env = env.trimEnd() + "\n\n# Web Push (PWA)\n";
    }
    env += line + "\n";
  }
}

fs.writeFileSync(path, env.endsWith("\n") ? env : env + "\n");
fs.writeFileSync("vapid-public-only.txt", keys.publicKey + "\n");
console.log("Chaves gravadas em .env.local");
console.log("PUBLIC_KEY_FILE=vapid-public-only.txt");
