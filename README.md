# FileGuard - Gmail Attachment Scanner

A Chrome extension that enhances Gmail's security by scanning attachments for malware using VirusTotal API.

## Features

- Real-time malware scanning of Gmail attachments
- Integration with VirusTotal's comprehensive threat database
- Support for multiple file types (.doc, .docx, .pdf, .txt, .xls, .xlsx, .csv, .zip, .rar, .7z, .exe)
- Color-coded results (green for safe, orange for suspicious, red for malicious)
- Detailed security reports
- Batch scanning of multiple attachments
- Privacy-focused (no file content storage)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/aleenagibi/fileguard.git
cd fileguard
```

2. Create a `.env` file with your VirusTotal API key:
```
VIRUSTOTAL_API_KEY=your_virustotal_api_key_here
```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

## Usage

1. Open Gmail in Chrome
2. When viewing an email with attachments, you'll see a "Scan" button next to each attachment
3. Click the button to scan the attachment
4. View the detailed security report

## Development

- `content.js` - Main extension logic
- `background.js` - Background service worker
- `popup.html/js` - Extension popup interface
- `style.css` - Extension styles

## Security

- All file scans are performed using VirusTotal's API
- No file details are stored
- All communication is encrypted


