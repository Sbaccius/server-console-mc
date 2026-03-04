import asyncio
import os
import subprocess
import threading
import json
import httpx
import psutil
import sys
import download_utils
import time
import urllib.parse
from pathlib import Path
from typing import Dict, Any
from fastapi import FastAPI, HTTPException, WebSocket, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Helper for PyInstaller path resolution
def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return Path(sys._MEIPASS) / relative_path
    return Path(".") / relative_path

app = FastAPI()

# Capture the main asyncio event loop when the server starts
# This is used to safely send WebSocket messages from background threads
_main_loop: asyncio.AbstractEventLoop | None = None

@app.on_event("startup")
async def on_startup():
    global _main_loop
    _main_loop = asyncio.get_event_loop()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INSTANCES_DIR = Path("instances")
INSTANCES_DIR.mkdir(exist_ok=True)

class ServerInstance:
    def __init__(self, server_id: str, server_dir: Path):
        self.server_id = server_id
        self.server_dir = server_dir
        self.process = None
        self.logs = []
        self.clients = set()
        self.lock = threading.Lock()
        self._psutil_proc = None
        self.status = "ready" # "ready", "downloading", or "error"
        self.error_message = ""
        self._cpu_usage = 0.0
        self._ram_usage = 0.0
        self._monitor_thread = None
        self._stop_monitor = False
        
        # Load metadata
        self.meta = {}
        meta_file = self.server_dir / "server.json"
        if meta_file.exists():
            with open(meta_file, "r") as f:
                self.meta = json.load(f)

    def _monitor_loop(self):
        while not self._stop_monitor:
            if self.process and self.process.poll() is None:
                try:
                    if not self._psutil_proc or self._psutil_proc.pid != self.process.pid:
                        self._psutil_proc = psutil.Process(self.process.pid)
                        self._psutil_proc.cpu_percent(None) # Initialize CPU percent
                    
                    self._cpu_usage = self._psutil_proc.cpu_percent(interval=1.0)
                    self._ram_usage = self._psutil_proc.memory_info().rss / (1024 * 1024)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    self._psutil_proc = None
                    self._cpu_usage = 0.0
                    self._ram_usage = 0.0
            else:
                self._cpu_usage = 0.0
                self._ram_usage = 0.0
            time.sleep(1) # Check every second

    def is_running(self):
        return self.process is not None and self.process.poll() is None

    def start(self):
        if self.is_running():
            return False, "Already running"
            
        jar_path = self.server_dir / "server.jar"
        if not jar_path.exists():
            return False, "server.jar not found. Please wait for download to finish."

        java_cmd_path = "java"
        provider = self.meta.get("java_provider", "system")
        if provider != "system":
            is_windows = sys.platform == "win32"
            java_exe = "bin/java.exe" if is_windows else "bin/java"
            local_java = INSTANCES_DIR / "java" / provider / java_exe
            if local_java.exists():
                java_cmd_path = str(local_java.resolve())
            else:
                return False, f"Local Java {provider} executable not found."

        ram_mb = self.meta.get("ram_mb", 1024)

        try:
            # JVM Optimizations (Aikar's Flags inspired)
            cmd = [
                java_cmd_path,
                f"-Xmx{ram_mb}M",
                f"-Xms{ram_mb}M",
                "-XX:+UseG1GC",
                "-XX:+ParallelRefProcEnabled",
                "-XX:MaxGCPauseMillis=200",
                "-XX:+UnlockExperimentalVMOptions",
                "-XX:+DisableExplicitGC",
                "-XX:+AlwaysPreTouch",
                "-XX:G1NewSizePercent=30",
                "-XX:G1MaxNewSizePercent=40",
                "-XX:G1HeapRegionSize=8M",
                "-XX:G1ReservePercent=20",
                "-XX:G1HeapWastePercent=5",
                "-XX:G1MixedGCCountTarget=4",
                "-XX:InitiatingHeapOccupancyPercent=15",
                "-XX:G1MixedGCLiveThresholdPercent=90",
                "-XX:G1RSetUpdatingPauseTimePercent=5",
                "-XX:SurvivorRatio=32",
                "-XX:+PerfDisableSharedMem",
                "-XX:MaxTenuringThreshold=1",
                "-Dusing.aikars.flags=https://mcflags.emc.gs",
                "-Daikars.new.flags=true",
                "-jar", "server.jar",
                "nogui"
            ]
            
            self.process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=str(self.server_dir)
            )
        except Exception as e:
            return False, f"Failed to start server: {str(e)}"
        
        self._stop_monitor = False
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()
        
        threading.Thread(target=self._read_output, daemon=True).start()
        return True, "Started"

    def _read_output(self):
        for line in iter(self.process.stdout.readline, ''):
            if not line:
                break
            line = line.strip()
            with self.lock:
                # Keep last 1000 lines max in memory
                if len(self.logs) > 1000:
                    self.logs.pop(0)
                self.logs.append(line)
                if _main_loop and not _main_loop.is_closed():
                    for client in list(self.clients):
                        asyncio.run_coroutine_threadsafe(
                            self._send_to_client(client, line),
                            _main_loop
                        )

    async def _send_to_client(self, client, line: str):
        try:
            await client.send_text(line)
        except Exception:
            with self.lock:
                self.clients.discard(client)

    def write_command(self, cmd: str):
        if self.is_running():
            self.process.stdin.write(cmd + "\n")
            self.process.stdin.flush()
            return True
        return False

    def stop(self):
        if self.is_running():
            self.write_command("stop")
            # We don't terminate immediately, let it save
            return True
        return False

class ServerManager:
    def __init__(self):
        self.instances: Dict[str, ServerInstance] = {}
        self.load_instances()

    def load_instances(self):
        if not INSTANCES_DIR.exists():
            return
        for path in INSTANCES_DIR.iterdir():
            if path.is_dir():
                # Verify it has standard files
                if (path / "server.json").exists():
                    self.instances[path.name] = ServerInstance(path.name, path)

    def get_instance(self, server_id: str) -> ServerInstance:
        return self.instances.get(server_id)

manager = ServerManager()

class CommandRequest(BaseModel):
    command: str

class CreateServerRequest(BaseModel):
    name: str # e.g. "Survival SMP"
    server_id: str # e.g. "survival-smp"
    type: str # "vanilla", "purpur", "fabric"
    version: str # e.g. "1.20.4"
    java_provider: str = "system" # "system", "adoptium", "corretto", "openjdk"
    ram_mb: int = 1024 # RAM in MB for -Xmx/-Xms flags

@app.get("/api/servers")
async def get_servers():
    servers = []
    for server_id, instance in manager.instances.items():
        meta_file = instance.server_dir / "server.json"
        meta = {}
        if meta_file.exists():
            with open(meta_file, "r") as f:
                meta = json.load(f)
        
        server_data = {
            "id": server_id,
            "name": meta.get("name", server_id),
            "type": meta.get("type", "unknown"),
            "version": meta.get("version", "unknown"),
            "running": instance.is_running(),
            "status": getattr(instance, 'status', 'ready'),
            "error_message": getattr(instance, 'error_message', ''),
            "ram_mb": meta.get("ram_mb", 1024),
            "cpu": getattr(instance, '_cpu_usage', 0.0),
            "ram": getattr(instance, '_ram_usage', 0.0)
        }
        servers.append(server_data)
    return servers

@app.get("/api/versions/{server_type}")
async def get_versions(server_type: str):
    try:
        if server_type == "vanilla":
            return download_utils.get_vanilla_versions()
        elif server_type == "purpur":
            return download_utils.get_purpur_versions()
        elif server_type == "fabric":
            return download_utils.get_fabric_versions()
        else:
            raise HTTPException(status_code=400, detail="Unknown server type")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def download_server_sync(req: CreateServerRequest):
    target_dir = INSTANCES_DIR / req.server_id
    target_dir.mkdir(exist_ok=True)
    
    # Save metadata
    with open(target_dir / "server.json", "w") as f:
        json.dump(req.model_dump(), f)
        
    # Create EULA
    with open(target_dir / "eula.txt", "w") as f:
        f.write("eula=true\n")
        
    jar_path = target_dir / "server.jar"
    
    # Actual download logic
    try:
        # 1. Download Java
        if req.java_provider != "system":
            java_base = INSTANCES_DIR / "java"
            java_base.mkdir(exist_ok=True)
            download_utils.download_and_extract_java(req.java_provider, java_base)

        # 2. Download Server Jar
        if req.type == "purpur":
            download_utils.download_purpur(req.version, str(jar_path))
        elif req.type == "vanilla":
            download_utils.download_vanilla(req.version, str(jar_path))
        elif req.type == "fabric":
            download_utils.download_fabric(req.version, str(jar_path))

        instance = manager.get_instance(req.server_id)
        if instance:
            instance.status = "ready"
            instance.error_message = ""

    except Exception as e:
        error_msg = str(e)
        print(f"Error downloading {req.server_id}: {error_msg}")
        instance = manager.get_instance(req.server_id)
        if instance:
            instance.status = "error"
            instance.error_message = error_msg
            # Persist error state to server.json
            try:
                meta_file = instance.server_dir / "server.json"
                meta = {}
                if meta_file.exists():
                    with open(meta_file, "r") as f:
                        meta = json.load(f)
                meta["status"] = "error"
                meta["error_message"] = error_msg
                with open(meta_file, "w") as f:
                    json.dump(meta, f)
            except Exception as save_err:
                print(f"Failed to persist error state: {save_err}")

@app.post("/api/servers/create")
async def create_server(req: CreateServerRequest, background_tasks: BackgroundTasks):
    if req.server_id in manager.instances:
        raise HTTPException(status_code=400, detail="Server ID already exists")
    
    background_tasks.add_task(download_server_sync, req)
    
    # Create the instance early so it shows up in the dashboard
    target_dir = INSTANCES_DIR / req.server_id
    target_dir.mkdir(exist_ok=True)
    instance = ServerInstance(req.server_id, target_dir)
    instance.status = "downloading"
    instance.error_message = ""
    instance.meta = req.model_dump() # preview meta
    manager.instances[req.server_id] = instance
    
    return {"status": "downloading", "server_id": req.server_id}

@app.post("/api/servers/{server_id}/start")
async def start_server(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
        
    success, msg = instance.start()
    if success:
        return {"status": "started"}
    raise HTTPException(status_code=400, detail=msg)


class JavaUpdate(BaseModel):
    java_provider: str

@app.post("/api/servers/{server_id}/config/java")
async def update_java_config(server_id: str, req: JavaUpdate):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    
    instance.meta["java_provider"] = req.java_provider
    meta_file = instance.server_dir / "server.json"
    with open(meta_file, "w") as f:
        json.dump(instance.meta, f)
        
    return {"status": "updated", "java_provider": req.java_provider}

class RamUpdate(BaseModel):
    ram_mb: int

@app.post("/api/servers/{server_id}/config/ram")
async def update_ram_config(server_id: str, req: RamUpdate):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    if req.ram_mb < 512 or req.ram_mb > 65536:
        raise HTTPException(status_code=400, detail="ram_mb must be between 512 and 65536")

    instance.meta["ram_mb"] = req.ram_mb
    meta_file = instance.server_dir / "server.json"
    with open(meta_file, "w") as f:
        json.dump(instance.meta, f)

    return {"status": "updated", "ram_mb": req.ram_mb}

@app.get("/api/servers/{server_id}/files")
async def list_files(server_id: str, path: str = "."):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    
    target_path = (instance.server_dir / path).resolve()
    # Security check: ensure path is inside server_dir
    if not str(target_path).startswith(str(instance.server_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")
        
    files = []
    for item in target_path.iterdir():
        files.append({
            "name": item.name,
            "is_dir": item.is_dir(),
            "size": item.stat().st_size if item.is_file() else 0,
            "mtime": item.stat().st_mtime
        })
    return files

@app.get("/api/servers/{server_id}/files/content")
async def get_file_content(server_id: str, path: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    
    target_path = (instance.server_dir / path).resolve()
    if not str(target_path).startswith(str(instance.server_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
        
    if not target_path.is_file():
        raise HTTPException(status_code=400, detail="Not a file")
        
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FileUpdate(BaseModel):
    content: str

@app.post("/api/servers/{server_id}/files/content")
async def save_file_content(server_id: str, path: str, req: FileUpdate):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    
    target_path = (instance.server_dir / path).resolve()
    if not str(target_path).startswith(str(instance.server_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
        
    try:
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/servers/{server_id}/files")
async def delete_file(server_id: str, path: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    
    target_path = (instance.server_dir / path).resolve()
    if not str(target_path).startswith(str(instance.server_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
        
    try:
        if target_path.is_dir():
            import shutil
            shutil.rmtree(target_path)
        else:
            target_path.unlink()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/servers/{server_id}/stop")
async def stop_server(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    if instance.stop():
        return {"status": "stopping"}
    raise HTTPException(status_code=400, detail="Server is not running")

@app.delete("/api/servers/{server_id}")
async def delete_server(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if instance.is_running():
        instance.stop()
        # Wait for the process to actually terminate to avoid busy locks on Windows/Linux
        import time
        for _ in range(20): # wait up to 10 seconds
            if not instance.is_running():
                break
            time.sleep(0.5)
        
        # If still running, force kill
        if instance.is_running() and instance.process:
            try:
                instance.process.terminate()
                instance.process.wait(timeout=2)
            except:
                instance.process.kill()

    import shutil
    import os
    
    # Check if directory exists
    if not os.path.exists(instance.server_dir):
        if server_id in manager.instances:
            del manager.instances[server_id]
        return {"status": "deleted", "message": "Directory already gone, instance removed from memory"}

    # Retry a few times for directory deletion in case of slow file release
    for i in range(3):
        try:
            shutil.rmtree(instance.server_dir)
            break
        except Exception as e:
            if i == 2: # last attempt
                raise HTTPException(status_code=500, detail=f"Failed to delete directory after retries: {e}")
            time.sleep(1)

    if server_id in manager.instances:
        del manager.instances[server_id]
    return {"status": "deleted"}

@app.post("/api/servers/{server_id}/command")
async def send_command(server_id: str, req: CommandRequest):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    if instance.write_command(req.command):
        return {"status": "sent", "command": req.command}
    raise HTTPException(status_code=400, detail="Server is not running")

@app.get("/api/servers/{server_id}/addons/search")
async def search_addons(server_id: str, query: str = ""):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
        
    stype = instance.meta.get("type", "")
    version = instance.meta.get("version", "")
    
    try:
        async with httpx.AsyncClient() as client:
            if stype == "fabric":
                # Modrinth Logic
                categories = ["categories:fabric"]
                facets = [
                    ["project_type:plugin", "project_type:mod"],
                    categories,
                    [f"versions:{version}"]
                ]
                facets_str = json.dumps(facets)
                url = f"https://api.modrinth.com/v2/search?query={urllib.parse.quote(query)}&facets={urllib.parse.quote(facets_str)}&limit=20"
                r = await client.get(url, headers={'User-Agent': 'server-console-mc/1.0'})
                r.raise_for_status()
                data = r.json()
                
                unified_results = []
                for hit in data.get('hits', []):
                    unified_results.append({
                        "id": hit["project_id"],
                        "title": hit["title"],
                        "author": hit["author"],
                        "description": hit["description"],
                        "downloads": hit.get("downloads", 0),
                        "icon_url": hit.get("icon_url"),
                        "is_external": False,
                        "external_url": None,
                        "provider": "modrinth"
                    })
                return {"hits": unified_results}
                
            elif stype in ["purpur", "vanilla"]:
                # Spiget Logic
                if not query:
                    return {"hits": []}
                url = f"https://api.spiget.org/v2/search/resources/{urllib.parse.quote(query)}?size=20&fields=id,name,tag,downloads,icon,file,author"
                r = await client.get(url, headers={'User-Agent': 'server-console-mc/1.0'})
                r.raise_for_status()
                data = r.json()
                
                # Fetch author names (they are not included by default in search sadly, but we can try)
                unified_results = []
                for hit in data:
                    is_external = hit.get('file', {}).get('type') != '.jar'
                    # Spiget icons are tricky, often missing or require explicit fetching. 
                    # We will provide the external URL if it exists
                    external_url = hit.get('file', {}).get('externalUrl')
                    
                    unified_results.append({
                        "id": str(hit["id"]),
                        "title": hit.get("name", "Unknown"),
                        "author": f"AuthorID: {hit.get('author', {}).get('id', 'Unknown')}", # Author text name requires another endpoint
                        "description": hit.get("tag", ""),
                        "downloads": hit.get("downloads", 0),
                        "icon_url": None,
                        "is_external": is_external,
                        "external_url": external_url,
                        "provider": "spiget"
                    })
                return {"hits": unified_results}
            else:
                return {"hits": []}
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class InstallAddonRequest(BaseModel):
    project_id: str
    provider: str

@app.post("/api/servers/{server_id}/addons/install")
async def install_addon(server_id: str, req: InstallAddonRequest, background_tasks: BackgroundTasks):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
        
    stype = instance.meta.get("type", "")
    version = instance.meta.get("version", "")
    
    target_folder = instance.server_dir / ("mods" if stype == "fabric" else "plugins")
    target_folder.mkdir(exist_ok=True)
    
    try:
        if req.provider == "modrinth":
            loaders = '["fabric"]' if stype == "fabric" else '["paper","purpur","spigot"]'
            url = f"https://api.modrinth.com/v2/project/{req.project_id}/version"
            versions_array_str = f'["{version}"]'
            url += f"?loaders={urllib.parse.quote(loaders)}&game_versions={urllib.parse.quote(versions_array_str)}"
            
            async with httpx.AsyncClient() as client:
                r = await client.get(url, headers={'User-Agent': 'server-console-mc/1.0'})
                r.raise_for_status()
                versions = r.json()
                if not versions:
                    raise HTTPException(status_code=404, detail="No compatible version found for your server.")
                
                target_ver = versions[0]
                download_url = None
                filename = None
                for f in target_ver['files']:
                    if f['primary']:
                        download_url = f['url']
                        filename = f['filename']
                        break
                
                if not download_url and target_ver['files']:
                    download_url = target_ver['files'][0]['url']
                    filename = target_ver['files'][0]['filename']
                    
                if not download_url:
                    raise HTTPException(status_code=404, detail="No downloadable file found.")
                    
        elif req.provider == "spiget":
            url = f"https://api.spiget.org/v2/resources/{req.project_id}"
            async with httpx.AsyncClient() as client:
                r = await client.get(url, headers={'User-Agent': 'server-console-mc/1.0'})
                r.raise_for_status()
                data = r.json()
                
                # Double check it is actually a jar
                if data.get('file', {}).get('type') != '.jar':
                    raise HTTPException(status_code=400, detail="This plugin cannot be directly downloaded. Please use the external link.")
                    
                filename = f"{data.get('name', 'plugin').replace(' ', '_')}-{data.get('version', {}).get('id', 'latest')}.jar"
                download_url = f"https://api.spiget.org/v2/resources/{req.project_id}/download"
        else:
            raise HTTPException(status_code=400, detail="Unknown provider")
            
        target_file = target_folder / filename
        async with httpx.AsyncClient(follow_redirects=True) as client:
            async with client.stream("GET", download_url, headers={'User-Agent': 'server-console-mc/1.0'}) as response:
                response.raise_for_status()
                with open(target_file, "wb") as f:
                    async for chunk in response.aiter_bytes():
                        f.write(chunk)
                        
        return {"status": "success", "filename": filename}
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
        
    def download_task():
        try:
            with httpx.stream("GET", download_url, follow_redirects=True) as r:
                r.raise_for_status()
                with open(target_folder / filename, "wb") as f:
                    for chunk in r.iter_raw():
                        f.write(chunk)
        except Exception as e:
            print(f"Error downloading plugin: {e}")
            
    background_tasks.add_task(download_task)
    return {"status": "downloading", "filename": filename}

@app.get("/api/servers/{server_id}/config")
async def get_config(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    prop_file = instance.server_dir / "server.properties"
    if not prop_file.exists():
        return {"properties": {}}
        
    props = {}
    with open(prop_file, "r") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                key, val = line.strip().split("=", 1)
                props[key] = val
    return {"properties": props}

@app.put("/api/servers/{server_id}/config")
async def save_config(server_id: str, body: Dict[str, str]):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    prop_file = instance.server_dir / "server.properties"
    
    # Simple write, overwriting comments
    with open(prop_file, "w") as f:
        f.write("#Minecraft server properties\n")
        for key, val in body.items():
            f.write(f"{key}={val}\n")
            
    return {"status": "saved"}

@app.get("/api/servers/{server_id}/players")
async def get_players(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
    
    cache_file = instance.server_dir / "usercache.json"
    players = []
    if cache_file.exists():
        try:
            with open(cache_file, "r") as f:
                players = json.load(f)
        except:
            pass
            
    # Normalize data for frontend
    # Format: [{"name": "...", "uuid": "...", "expiresOn": "..."}]
    return players

@app.get("/api/servers/{server_id}/world")
async def get_world_info(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
        
    # Find world name from properties
    props_res = await get_config(server_id)
    world_name = props_res.get("properties", {}).get("level-name", "world")
    
    world_dir = instance.server_dir / world_name
    size_bytes = 0
    if world_dir.exists():
        for root, dirs, files in os.walk(world_dir):
            for f in files:
                fp = os.path.join(root, f)
                size_bytes += os.path.getsize(fp)
                
    return {
        "name": world_name,
        "size_mb": round(size_bytes / (1024 * 1024), 2),
        "path": str(world_dir)
    }

@app.post("/api/servers/{server_id}/world/reset")
async def reset_world(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
        
    was_running = instance.is_running()
    if was_running:
        instance.stop()
        # Wait for stop
        import time
        for _ in range(20):
            if not instance.is_running(): break
            time.sleep(0.5)
            
    props_res = await get_config(server_id)
    world_name = props_res.get("properties", {}).get("level-name", "world")
    world_dir = instance.server_dir / world_name
    
    if world_dir.exists():
        import shutil
        shutil.rmtree(world_dir)
        
    if was_running:
        instance.start()
        
    return {"status": "success", "message": "World reset and server restarted"}

@app.get("/api/servers/{server_id}/network")
async def get_network_status(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
        
    import upnpy
    import socket
    
    # Get local IP
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
    finally:
        s.close()
        
    external_ip = "Unknown"
    upnp_enabled = False
    
    try:
        upnp = upnpy.UPnP()
        devices = upnp.discover()
        if devices:
            device = devices[0]
            for srv in device.get_services():
                if "WANIPConnection" in srv.id or "WANPPPConnection" in srv.id:
                    if "GetExternalIPAddress" in [a.name for a in srv.get_actions()]:
                        external_ip = srv.get_action("GetExternalIPAddress")().get("NewExternalIPAddress")
                        upnp_enabled = True
                    break
    except:
        pass
        
    return {
        "local_ip": local_ip,
        "external_ip": external_ip,
        "upnp_available": upnp_enabled
    }

@app.post("/api/servers/{server_id}/network/upnp")
async def enable_upnp(server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Server not found")
        
    # Get port from properties
    props_res = await get_config(server_id)
    port = int(props_res.get("properties", {}).get("server-port", 25565))
    
    import upnpy
    import socket
    
    # Get local IP
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
    finally:
        s.close()
        
    try:
        upnp = upnpy.UPnP()
        devices = upnp.discover()
        if not devices:
            return {"status": "error", "message": "No UPnP devices found on network"}
            
        device = devices[0]
        service = None
        for srv in device.get_services():
            if "WANIPConnection" in srv.id or "WANPPPConnection" in srv.id:
                service = srv
                break
                
        if not service:
            return {"status": "error", "message": "Could not find WAN connection service"}
            
        action = service.get_action("AddPortMapping")
        action(
            NewRemoteHost="",
            NewExternalPort=port,
            NewProtocol="TCP",
            NewInternalPort=port,
            NewInternalClient=local_ip,
            NewEnabled=1,
            NewPortMappingDescription=f"MC Server: {server_id}",
            NewLeaseDuration=0
        )
        
        # Also map UDP for some features/versions
        try:
            action(
                NewRemoteHost="",
                NewExternalPort=port,
                NewProtocol="UDP",
                NewInternalPort=port,
                NewInternalClient=local_ip,
                NewEnabled=1,
                NewPortMappingDescription=f"MC Server: {server_id}",
                NewLeaseDuration=0
            )
        except: pass
        
        return {"status": "success", "message": f"Port {port} forwarded to {local_ip}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.websocket("/api/servers/{server_id}/logs")
async def websocket_logs(websocket: WebSocket, server_id: str):
    instance = manager.get_instance(server_id)
    if not instance:
        await websocket.close(code=1008, reason="Server not found")
        return
        
    await websocket.accept()
    with instance.lock:
        instance.clients.add(websocket)
        for log in instance.logs[-100:]:
            await websocket.send_text(log)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        with instance.lock:
            if websocket in instance.clients:
                instance.clients.remove(websocket)

# Serve static files from client/dist
DIST_PATH = get_resource_path("client/dist")
if DIST_PATH.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_PATH / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API routes are already handled above
        file_path = DIST_PATH / full_path
        if full_path != "" and file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_PATH / "index.html")
