"""Preserve notices for installed production packages; does not change dependencies."""
import json
import pathlib
import shutil
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
result = subprocess.run(
    ["npm.cmd" if __import__("os").name == "nt" else "npm", "ls", "--omit=dev", "--all", "--parseable"],
    cwd=root, capture_output=True, text=True, check=True,
    shell=__import__("os").name == "nt",
)
out = root / "public" / "licenses"
out.mkdir(parents=True, exist_ok=True)
notices = out / "packages"
notices.mkdir(exist_ok=True)
records = []
for line in result.stdout.splitlines():
    package_path = pathlib.Path(line.strip())
    if package_path == root or not (package_path / "package.json").is_file():
        continue
    package = json.loads((package_path / "package.json").read_text(encoding="utf-8"))
    name = package.get("name", package_path.name)
    safe_name = name.replace("@", "").replace("/", "__")
    copied = []
    for item in package_path.iterdir():
        if item.is_file() and item.name.lower().startswith(("license", "licence", "copying", "notice")):
            destination = notices / f"{safe_name}-{item.name}.txt"
            shutil.copyfile(item, destination)
            copied.append(destination.relative_to(out).as_posix())
    records.append({"name": name, "version": package.get("version"), "license": package.get("license"),
                    "repository": package.get("repository"), "notices": copied})
(out / "dependencies.json").write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Preserved metadata and available notices for {len(records)} production packages.")
