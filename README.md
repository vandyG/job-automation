# Listbox Automation Browser Extension

This Chrome extension automates the selection of listbox values based on predefined data.

## Features

- **Automated Listbox Selection**: Automatically selects values in dropdown listboxes based on JSON configuration
- **Listbox Detection**: Detects all listboxes on the current page
- **User-Friendly Interface**: Simple popup interface for configuration and control
- **Background Operation**: Works across different tabs and pages
- **Error Handling**: Comprehensive error reporting and logging

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the extension folder
4. The extension icon should appear in your browser toolbar

## Usage

1. **Navigate** to a page with listboxes you want to automate
2. **Click** the extension icon in the toolbar
3. **Configure** the JSON data in the textarea (default data is pre-loaded)
4. **Click "Start Automation"** to begin the process
5. **Click "Detect Listboxes"** to see all available listboxes on the page

## JSON Data Format

The extension expects JSON data in the following format:

```json
{
    "elementNameOrId": {
        "value": "optionValue",
        "text": "Display Text"
    }
}
```

Example:
```json
{
    "4c40c353a422102cab96a149d1e30002": {
        "value": "b27175f300cb100f7d07fb2243fd0001",
        "text": "Yes"
    }
}
```

## How It Works

1. **Detection**: The extension finds listbox buttons using `aria-haspopup="listbox"`
2. **Opening**: Clicks the button to open the dropdown
3. **Selection**: Finds the option by value or text and clicks it
4. **Validation**: Triggers appropriate events and verifies selection

## Supported Elements

- Standard HTML `<select>` elements
- Custom dropdown components with ARIA attributes
- Buttons with `aria-haspopup="listbox"`
- Various dropdown implementations

## Troubleshooting

- **Extension not working**: Make sure you have the latest version of Chrome
- **Listboxes not found**: Check that the page has loaded completely
- **Selection failed**: Verify the JSON data matches the actual page elements
- **Background execution**: The extension works best when the tab is active

## Development

To modify the extension:

1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the reload button for the extension
4. Test your changes

## Files

- `manifest.json`: Extension configuration
- `popup.html/js`: User interface
- `content.js`: Page interaction logic
- `background.js`: Background service worker
- `README.md`: This documentation

## Permissions

- `activeTab`: Access to the current active tab
- `scripting`: Ability to inject scripts into pages

## License

This extension is provided as-is for automation purposes.
