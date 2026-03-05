import { router, publicProcedure, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { parseAudioFile, SUPPORTED_EXTENSIONS } from '@/server/music'
import { promises as fs } from 'fs'

async function scanDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      if (entry.isDirectory()) {
        const subFiles = await scanDirectory(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'))
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    console.error(`Failed to scan ${dirPath}:`, error)
  }
  return files
}

export const scanRouter = router({
  discover: protectedProcedure
    .input(z.object({ path: z.string() }))
    .mutation(async ({ input }) => {
      const files = await scanDirectory(input.path);
      return { files, total: files.length };
    }),

  processBatch: protectedProcedure
    .input(z.object({ files: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      let processed = 0;
      let failed = 0;

      await Promise.all(
        input.files.map(async (filePath) => {
          try {
            const parsed = await parseAudioFile(filePath);
            if (parsed) {
              await ctx.db.song.upsert({
                where: { filePath },
                update: parsed,
                create: {
                  ...parsed,
                  filePath,
                  fileName: filePath.split("/").pop() || "",
                },
              });
              processed++;
            } else {
              failed++;
            }
          } catch (error) {
            console.error(`Failed to process file ${filePath}:`, error);
            failed++;
          }
        })
      );

      return { processed, failed };
    }),
});
