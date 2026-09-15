# VADOWN

A modern, fast, and lightweight media downloader desktop application built with [Tauri](https://tauri.app/), [React](https://reactjs.org/), and [TypeScript](https://www.typescriptlang.org/). Powered by `yt-dlp` and `ffmpeg` under the hood.

## Features

- **Modern Desktop Interface**: Built with React, Vite, Tailwind CSS, and Shadcn UI.
- **Cross-Platform Support**: Utilizes the power of Rust & Tauri.
- **Robust Downloading**: Uses `yt-dlp` to download content from a wide range of supported media sites.
- **Media Processing**: Uses `ffmpeg` for post-processing and format conversions.

## 📥 Download & Installation

Pre-built packages for macOS, Windows, and Linux are available on the **[Releases](https://github.com/mahmingtea/vadown/releases/latest)** page:

- 🍎 **macOS (Apple Silicon M1/M2/M3/M4)**: Download the **`.dmg`** file (e.g., `vadown_*_aarch64.dmg`).
- 🪟 **Windows (64-bit)**: Download the **`.exe`** installer (e.g., `vadown_*_x64-setup.exe`) or the **`.msi`** package.
- 🐧 **Linux (64-bit)**: Download the **`.AppImage`** or **`.deb`** package.

### 🍎 macOS Installation Note
Because VADown is an open-source tool without a paid Apple Developer certificate, macOS Gatekeeper may display:
> *"vadown is damaged and can't be opened. You should move it to the Bin."*

**To open it in seconds:**
1. Open the `.dmg` and drag `vadown.app` into your `/Applications` folder.
2. Open **Terminal** and run:
   ```bash
   xattr -cr /Applications/vadown.app
   ```
3. Open VADown normally.

## Prerequisites

Before you begin, ensure you have the following installed:

1. [Rust and Cargo](https://www.rust-lang.org/tools/install)
2. Node.js and a package manager (npm, yarn, pnpm, or [Bun](https://bun.sh/))
3. [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system.

### External Binaries Configuration

Because `vadown` heavily relies on `yt-dlp` and `ffmpeg`/`ffprobe`, you must download and place these executable binaries into the `src-tauri/bin/` directory before building or running the project locally.

**Where to download the binaries:**
- **yt-dlp**: Download the executable for your OS from the [yt-dlp releases page](https://github.com/yt-dlp/yt-dlp/releases). 
- **ffmpeg and ffprobe**: Download the static builds for your OS from [ffbinaries](https://ffbinaries.com/downloads) or [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases).

Tauri requires external binaries (sidecars) to have a target triple appended to their filename.

**For Apple Silicon (M-series Macs)**, name your binaries like this:
- `yt-dlp-aarch64-apple-darwin`
- `ffmpeg-aarch64-apple-darwin`
- `ffprobe-aarch64-apple-darwin`

**For Windows (64-bit)**, name your binaries like this (ensure the target triple is placed before `.exe`):
- `yt-dlp-x86_64-pc-windows-msvc.exe`
- `ffmpeg-x86_64-pc-windows-msvc.exe`
- `ffprobe-x86_64-pc-windows-msvc.exe`

Refer to the [Tauri Sidecar Documentation](https://v2.tauri.app/learn/sidecar/) for specifics on target triples for Linux.

## How to Run Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/vadown.git
   cd vadown
   ```

2. **Install frontend dependencies**:
   ```bash
   # Using bun
   bun install
   
   # Or using npm
   npm install

   # Or using yarn
   yarn install

   # Or using pnpm
   pnpm install
   ```

3. **Install external binaries**:
   Ensure you've placed the properly named `yt-dlp`, `ffmpeg`, and `ffprobe` binaries in the `src-tauri/bin/` folder.

4. **Start the development server**:
   ```bash
   # Using bun
   bun run tauri dev

   # Or using npm
   npm run tauri dev

   # Or using yarn
   yarn tauri dev

   # Or using pnpm
   pnpm tauri dev
   ```

## How to Build

To build an optimized release bundle (e.g., `.dmg`, `.app`, `.exe`, or `.deb`) for your operating system:

```bash
# Using bun
bun run tauri build

# Or using npm
npm run tauri build

# Or using yarn
yarn tauri build

# Or using pnpm
pnpm tauri build
```

Once the build is complete, your installer and executable will be available inside the `src-tauri/target/release/bundle/` directory.

## Contributing

Contributions, issues, and feature requests are welcome!

### Reporting Issues
If you encounter bugs or want to request a feature, please [open an issue](https://github.com/mahmingtea/vadown/issues) on GitHub. Be sure to provide relevant details and steps to reproduce any bugs.

### Submitting Pull Requests
1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please make sure to run tests and ensure the build succeeds before submitting a PR.

## 📄 License

This project is primarily licensed under the MIT License.
