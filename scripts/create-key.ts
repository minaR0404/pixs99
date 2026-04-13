import { createApiKey } from "../src/lib/auth";

const name = process.argv[2] ?? "default";
createApiKey(name).then((key) => {
  console.log(`API Key created: ${key}`);
});
