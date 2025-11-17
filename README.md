# Wwisa - Web-Based Wwise Audio Player

A browser-based audio middleware interface that enables playback of Wwise sound banks (.wem files) without requiring Wwise software installation. Built with React, Node.js, and WebAssembly bindings for Wwise SDK 2022.1.3.

## Features

- Load and play Wwise sound banks directly in the browser
- Trigger Wwise events and control RTPCs (Real-Time Parameter Controls)
- User authentication and file management system
- Drag-and-drop action slots for organizing audio controls
- Real-time audio rendering via Web Audio API

## Demo Files

Sample Wwise files are included in the `backend/filesForTesting` directory for testing without Wwise access:

- `Init.bnk` - Initialization bank
- `CloudBank.bnk` - Sample sound bank
- `defaultWorkUnit.wwu` - Work unit file with RTPC definitions
- `SoundbanksInfo.xml` - Metadata file with event/RTPC mappings

## Setup

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd wwisa
```

2. Install frontend dependencies

```bash
npm install
```

3. Install backend dependencies

```bash
cd backend
npm install
```

4. Configure backend environment

```bash
cd backend
cp .env.example .env
```

### Running the Application

1. Start the backend server (from `backend` directory)

```bash
npm run dev
# Server runs on http://localhost:3001
```

2. Start the frontend (from root directory, in a new terminal)

```bash
npm start
# App opens at http://localhost:3000
```

## Usage

1. Register/login to create an account (email is not used, but will be in future versions)
2. Upload the demo files from `backend` directory (or your own Wwise exports):
   - Init.bnk (required)
   - Your sound bank (.bnk file)
   - SoundbanksInfo.xml (required for event/RTPC detection)
   - Work unit file (.wwu, optional for RTPC ranges)
3. Click "ENABLE AUDIO" to initialize the audio system
4. Load the files and add action slots to trigger events or control RTPCs

## Technical Details

- **Frontend**: React with Web Audio API and WebAssembly
- **Backend**: Express.js with SQLite database
- **Audio Engine**: Wwise 2022.1.3 compiled to WebAssembly
- **File Storage**: User-scoped file system with authentication

## Browser Requirements

- Modern browser with WebAssembly support (preferably Chrome or Chromium based)
- SharedArrayBuffer support

## License

MIT License - See LICENSE file for details
