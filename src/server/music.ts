import { promises as fs } from "fs";
import path from "path";

export async function parseAudioFile(filePath: string) {
  try {
    const mm = await import("music-metadata");
    // @ts-ignore
    const metadata = await mm.parseFile(filePath);
    const { common, format } = metadata;

    let coverPath: string | null = null;

    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      const ext = picture.format.includes("jpeg")
        ? "jpg"
        : picture.format.includes("png")
          ? "png"
          : "jpg";
      // Use URL-safe base64 characters and ensure no path separators
      const safeName = Buffer.from(filePath)
        .toString("base64")
        .replace(/\//g, "_")
        .replace(/\+/g, "-")
        .slice(0, 32);
      const fileName = `${safeName}.${ext}`;
      const coverDir = path.join(process.cwd(), "public", "covers");
      const coverFilePath = path.join(coverDir, fileName);

      await fs.mkdir(coverDir, { recursive: true });
      await fs.writeFile(coverFilePath, picture.data);
      coverPath = `/covers/${fileName}`;
    }

    const lyrics = common.lyrics?.[0] || null;

    return {
      title: common.title || "",
      artist: common.artist || "",
      album: common.album || "",
      genre: common.genre?.[0] || "",
      year: common.year,
      duration: Math.round(format.duration || 0),
      trackNumber: common.track?.no,
      coverPath,
      lyrics,
    };
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

export const SUPPORTED_EXTENSIONS = [
  ".mp3",
  ".flac",
  ".wav",
  ".m4a",
  ".ogg",
  ".aac",
];
