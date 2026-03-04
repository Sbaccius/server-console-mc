# Minecraft Server Console

A modern, web-based management console for Minecraft servers. Built with **FastAPI** (Python) and **React** (TypeScript), it allows you to easily create, manage, and monitor multiple Minecraft server instances from a clean, intuitive interface.

## ✨ Features

- **Multi-Instance Dashboard**: Manage multiple servers simultaneously.
- **Server Support**: Built-in support for **Vanilla**, **Purpur**, and **Fabric**.
- **Automated Setup**: Automatic downloading and configuration of server JARs and compatible Java versions (Amazon Corretto, Adoptium, OpenJDK).
- **Real-time Console**: Interactive web console for monitoring logs and sending commands.
- **Resource Monitoring**: Live CPU and RAM usage tracking for each instance.
- **File Manager**: Integrated browser-based file management for editing configurations and managing files.
- **Addon Integration**: Search and install plugins/mods directly from **Modrinth** and **Spiget**.
- **Property Management**: User-friendly interface for editing `server.properties`.
- **Advanced Networking**: Automated port forwarding support via UPnP.

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend development)
- Java (system-wide or downloaded via console)

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Sbaccius/server-console-mc.git
   cd server-console-mc
   ```

2. **Backend Setup**:
   ```bash
   cd server
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python main.py
   ```

3. **Frontend Setup**:
   ```bash
   cd client
   npm install
   npm run dev
   ```

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Lucide React.
- **Backend**: FastAPI, asyncio, pydantic, httpx, psutil.
- **Styling**: Vanilla CSS with modern aesthetics.

## 📝 License

This project is for personal use. All rights reserved.
