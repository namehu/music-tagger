from pathlib import Path


TRACK_COVER_SIDECAR_EXTENSIONS = (".jpg", ".png")


def normalize_track_cover_sidecar_extension(extension: str) -> str:
    normalized = extension.strip().lower()
    return ".jpg" if normalized == ".jpeg" else normalized


def build_track_cover_sidecar_path(track_path: str | Path, extension: str) -> str:
    normalized = normalize_track_cover_sidecar_extension(extension)
    if normalized not in TRACK_COVER_SIDECAR_EXTENSIONS:
        raise RuntimeError(f"Unsupported cover extension: {extension}")

    return str(Path(track_path).with_suffix(normalized))


def get_track_cover_sidecar_candidates(
    track_path: str | Path,
    preferred_asset_path: str | None = None,
) -> list[Path]:
    candidates: list[Path] = []
    if preferred_asset_path:
        preferred_path = Path(preferred_asset_path)
        if preferred_path.suffix.lower() in TRACK_COVER_SIDECAR_EXTENSIONS:
            candidates.append(preferred_path)

    source_path = Path(track_path)
    for extension in TRACK_COVER_SIDECAR_EXTENSIONS:
        candidate = source_path.with_suffix(extension)
        if candidate not in candidates:
            candidates.append(candidate)

    return candidates


def find_existing_track_cover_sidecar(
    track_path: str | Path,
    preferred_asset_path: str | None = None,
) -> Path | None:
    for candidate in get_track_cover_sidecar_candidates(track_path, preferred_asset_path):
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()

    return None
