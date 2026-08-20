import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Set this to your GitHub repo name so assets resolve correctly on
// https://<username>.github.io/<repo-name>/
// If you deploy to a custom domain or to <username>.github.io (user/org page),
// change base back to "/".
const REPO_NAME = "pharmacy-salary-app";

export default defineConfig({
  plugins: [react()],
  base: `/${REPO_NAME}/`,
});
