# TabPilot

A Chrome extension that helps you manage browser tabs using AI-powered classification and analysis. TabPilot identifies old tabs and provides intelligent recommendations for tab management.

## Features

- **Tab Management**: Automatically detect and manage old/unused tabs
- **AI Classification**: Use AI to classify and analyze tab content
- **Multiple AI Providers**: Support for both Ollama (local) and Claude (Anthropic) AI models
- **Time Tracking**: Track how long tabs have been inactive
- **Smart Recommendations**: Get AI-powered suggestions for tab cleanup

## Installation

### 1. Backend Setup

The backend provides AI integration and tab analysis services.

#### Prerequisites
- Python 3.7+
- pip

#### Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### Start the Backend Server

```bash
cd backend
python ollama_host.py
```

The backend server will run on `http://localhost:5001`.

### 2. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `chrome` directory
4. The TabPilot extension should now appear in your extensions list

### 3. AI Provider Configuration

TabPilot supports two AI providers:

#### Option A: Ollama (Local AI)
- Install [Ollama](https://ollama.ai/) on your system
- Ensure Ollama is running on `http://localhost:11434`
- Select "Ollama" as your provider in the extension

#### Option B: Claude (Anthropic API)
- Get an API key from [Anthropic Console](https://console.anthropic.com/)
- In the TabPilot extension, select "Claude" as your provider
- Enter your Anthropic API key when prompted
- The key is stored locally in Chrome's extension storage

## Usage

1. Click the TabPilot extension icon to open the side panel
2. Select your preferred AI provider (Ollama or Claude)
3. If using Claude, enter your Anthropic API key
4. Click "Manage Old Tabs" to analyze and get recommendations for unused tabs
5. Use "Classify" to get AI-powered analysis of your current tabs

## Development

The project consists of two main components:

- **Backend** (`/backend`): Flask server that proxies requests to AI services
- **Chrome Extension** (`/chrome`): Browser extension with popup UI and background scripts

### Backend Structure
- `ollama_host.py`: Flask server for AI integration
- `requirements.txt`: Python dependencies

### Extension Structure
- `manifest.json`: Extension configuration
- `sidepanel.html`: Main UI
- `js/popup.js`: Extension logic and API integration
- `js/background.js`: Background service worker
- `styles/sidepanel.css`: UI styling

## API Key Security

- API keys are stored locally in Chrome's extension storage
- Keys are never transmitted except directly to the respective AI provider
- The backend server does not store or log API keys

## License

This project is for educational and personal use.