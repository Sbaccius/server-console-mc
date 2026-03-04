import httpx
import os
import zipfile
import tarfile
import shutil
import sys
from pathlib import Path

def get_vanilla_versions():
    url = "https://launchermeta.mojang.com/mc/game/version_manifest.json"
    r = httpx.get(url)
    r.raise_for_status()
    data = r.json()
    return [v["id"] for v in data["versions"] if v["type"] == "release"]

def get_purpur_versions():
    url = "https://api.purpurmc.org/v2/purpur"
    r = httpx.get(url)
    r.raise_for_status()
    data = r.json()
    return data["versions"]

def get_fabric_versions():
    url = "https://meta.fabricmc.net/v2/versions/game"
    r = httpx.get(url)
    r.raise_for_status()
    data = r.json()
    return [v["version"] for v in data if v["stable"]]

def download_vanilla(version: str, target_path: str):
    # 1. get manifest
    url = "https://launchermeta.mojang.com/mc/game/version_manifest.json"
    manifest = httpx.get(url).json()
    version_url = next(v["url"] for v in manifest["versions"] if v["id"] == version)
    
    # 2. get version json
    version_data = httpx.get(version_url).json()
    server_url = version_data["downloads"]["server"]["url"]
    
    # 3. download
    with httpx.stream("GET", server_url, follow_redirects=True) as r:
        r.raise_for_status()
        with open(target_path, "wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)

def download_purpur(version: str, target_path: str):
    url = f"https://api.purpurmc.org/v2/purpur/{version}/latest/download"
    with httpx.stream("GET", url, follow_redirects=True) as r:
        r.raise_for_status()
        with open(target_path, "wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)

def download_fabric(version: str, target_path: str):
    # Get latest loader
    loader_url = "https://meta.fabricmc.net/v2/versions/loader"
    loaders = httpx.get(loader_url).json()
    latest_loader = loaders[0]["version"]
    
    # Get latest installer
    installer_url = "https://meta.fabricmc.net/v2/versions/installer"
    installers = httpx.get(installer_url).json()
    latest_installer = installers[0]["version"]
    
    # Download
    url = f"https://meta.fabricmc.net/v2/versions/loader/{version}/{latest_loader}/{latest_installer}/server/jar"
    with httpx.stream("GET", url, follow_redirects=True) as r:
        r.raise_for_status()
        with open(target_path, "wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)

def download_and_extract_java(provider: str, target_base_dir: Path):
    if provider == "system":
        return
        
    is_windows = sys.platform == "win32"
    ext = "zip" if is_windows else "tar.gz"
    java_exe = "bin/java.exe" if is_windows else "bin/java"
    
    java_dir = target_base_dir / provider
    # Quick check if it already exists
    if (java_dir / java_exe).exists():
        print(f"Java {provider} already installed, skipping download.")
        return
        
    java_dir.mkdir(parents=True, exist_ok=True)
    archive_path = target_base_dir / f"{provider}.{ext}"
    
    url = ""
    # Hardcoding URLs for Java 21 x64
    if provider == "adoptium":
        os_name = "windows" if is_windows else "linux"
        url = f"https://api.adoptium.net/v3/binary/latest/21/ga/{os_name}/x64/jre/hotspot/normal/eclipse"
    elif provider == "corretto":
        if is_windows:
            url = "https://corretto.aws/downloads/latest/amazon-corretto-21-x64-windows-jdk.zip"
        else:
            url = "https://corretto.aws/downloads/latest/amazon-corretto-21-x64-linux-jdk.tar.gz"
    elif provider == "openjdk":
        if is_windows:
            url = "https://aka.ms/download-jdk/microsoft-jdk-21.0.6-windows-x64.zip"
        else:
            url = "https://aka.ms/download-jdk/microsoft-jdk-21.0.6-linux-x64.tar.gz"
        
    if not url:
        raise ValueError(f"Unknown Java provider or OS: {provider} on {sys.platform}")
        
    print(f"Downloading Java from {provider} for {sys.platform}...")
    with httpx.stream("GET", url, follow_redirects=True) as r:
        r.raise_for_status()
        with open(archive_path, "wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)
                
    print(f"Extracting Java {provider}...")
    if is_windows:
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(java_dir)
    else:
        with tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(java_dir)
        
    # Archive files usually extract into a subfolder (e.g., jdk-21.0.2/), we need to move the contents up
    extracted_items = [i for i in java_dir.iterdir() if i.name != "__pycache__"]
    if len(extracted_items) == 1 and extracted_items[0].is_dir():
        inner_dir = extracted_items[0]
        for item in inner_dir.iterdir():
            shutil.move(str(item), str(java_dir))
        inner_dir.rmdir()
        
    # Cleanup archive
    archive_path.unlink()
    print(f"Java {provider} installation complete.")
