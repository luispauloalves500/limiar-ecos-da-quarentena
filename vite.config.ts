import { defineConfig } from "vite";
export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: "index.html",
        zombieQA: "qa-zombies.html",
        playerQA: "qa-player.html",
      },
    },
  },
  base: "/limiar-ecos-da-quarentena/",
});
