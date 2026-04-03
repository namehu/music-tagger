import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
  experimental: {
    externalTables: true,
  },
  tables: {
    external: [
      "tracks_fts",
      "tracks_fts_config",
      "tracks_fts_content",
      "tracks_fts_data",
      "tracks_fts_docsize",
      "tracks_fts_idx",
    ],
  },
});
