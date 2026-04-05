import os
from pathlib import Path


TRACK_EDIT_ASSET_ROOT_ENV = "TRACK_EDIT_ASSET_ROOT"


def get_track_edit_asset_root() -> Path:
    configured_root = os.environ.get(TRACK_EDIT_ASSET_ROOT_ENV, "").strip()
    if configured_root:
        return Path(configured_root).expanduser().resolve()

    workspace_web_root = Path("/workspace/web")
    if workspace_web_root.exists():
        return (workspace_web_root / "storage" / "track-edit-assets").resolve()

    repo_web_root = Path(__file__).resolve().parents[1] / "web"
    return (repo_web_root / "storage" / "track-edit-assets").resolve()


def build_track_cover_asset_key(track_id: str, extension: str, basename: str = "cover") -> str:
    normalized_extension = extension.lower() if extension.startswith(".") else f".{extension.lower()}"
    safe_track_id = "".join(char if char.isalnum() or char in {"_", "-"} else "_" for char in track_id)
    return f"{safe_track_id}/{basename}{normalized_extension}"


def resolve_track_edit_asset_path(asset_path_or_key: str | None) -> Path | None:
    if not asset_path_or_key:
        return None

    path = Path(asset_path_or_key)
    if path.is_absolute():
        return path

    return (get_track_edit_asset_root() / asset_path_or_key).resolve()
