// Historical SQLite schema: only used to generate the migration reader.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/sqlite/schema.prisma',
  engine: 'classic',
  datasource: { url: 'file:../dev.db' },
});
