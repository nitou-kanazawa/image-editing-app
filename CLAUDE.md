# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a client-side image mosaic processing web application built with vanilla JavaScript. The app allows users to upload images and apply mosaic effects entirely in the browser without server-side processing.

## Architecture

### Core Classes
- **`MosaicApp`** (app.js): Main application controller that manages UI interactions, file handling, and coordinates between components
- **`ImageProcessor`** (imageProcessor.js): Handles canvas operations, image loading, and mosaic processing algorithms
- **`CONFIG`** (config.js): Centralized configuration object containing canvas settings, mosaic parameters, file constraints, and UI messages

### Key Design Patterns
- **Class-based architecture**: Separation of concerns between UI management and image processing
- **Configuration-driven**: All settings externalized to CONFIG object for easy customization
- **Promise-based async operations**: File loading and image processing use async/await patterns
- **Error boundary pattern**: Comprehensive error handling with user-friendly messages

### File Structure
```
├── index.html              # Main HTML structure with semantic sections
├── src/
│   ├── css/
│   │   └── styles.css      # BEM methodology CSS with responsive design
│   └── js/
│       ├── config.js       # Application configuration and constants
│       ├── utils.js        # Utility functions (validation, DOM helpers, debugging)
│       ├── imageProcessor.js # Canvas-based image processing logic
│       └── app.js          # Main application class and initialization
├── assets/
│   └── images/             # Static images (if needed)
├── docs/                   # Documentation
└── CLAUDE.md              # This file
```

## Development Commands

### Running the Application
```bash
# Open in browser (Windows)
start index.html

# Or serve locally for development
python -m http.server 8000
# Then navigate to http://localhost:8000
```

### Testing
```bash
# Open in browser and test with various image formats
# Supported: JPEG, PNG, WebP, GIF (up to 10MB)
```

## Key Configuration Points

### Mosaic Settings (src/js/config.js)
- `CONFIG.mosaic.defaultBlockSize`: Default mosaic block size (10px)
- `CONFIG.mosaic.minBlockSize`: Minimum block size (5px)  
- `CONFIG.mosaic.maxBlockSize`: Maximum block size (50px)

### Canvas Limits (src/js/config.js)
- `CONFIG.canvas.maxWidth/maxHeight`: Maximum canvas dimensions (800x600)
- Images are automatically scaled to fit within these bounds

### File Constraints (src/js/config.js)
- `CONFIG.file.maxSize`: Maximum file size (10MB)
- `CONFIG.file.allowedTypes`: Supported image formats

## Extension Points

### Adding New Image Effects
1. Extend `ImageProcessor` class with new processing methods
2. Follow the pattern: `_processEffectName(imageData, parameters)`
3. Update CONFIG.messages for new UI text

### Adding UI Controls
1. Add HTML elements in index.html following BEM naming
2. Register elements in `MosaicApp.initElements()`
3. Add event listeners in `MosaicApp.initEventListeners()`

### Customizing Mosaic Algorithm
- Modify `ImageProcessor._processMosaic()` method
- Adjust `_calculateAverageColor()` for different color sampling
- Modify `_fillBlock()` for different rendering styles

## Browser Compatibility

The app checks browser support for:
- Canvas API
- File API
- Download API

Debug logging is enabled on localhost for development.