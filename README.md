![Logo](https://github.com/user-attachments/assets/157fe3ec-be4c-4ea6-95e0-eddb40994198)
## FileGuard - Gmail Attachment Scanner

Built a Chrome extension that enhances Gmail’s security by scanning email attachments using the VirusTotal API. When an email contains an attachment, the extension automatically adds a “Scan” button beside the file. Upon clicking, the file hash is submitted to VirusTotal, where it is scanned against a wide array of antivirus engines. The extension then displays a concise summary of the scan results within Gmail, indicating whether any threats were detected. For more in-depth analysis, users are provided with a direct link to the full VirusTotal report on their website, offering detailed insights from multiple engines and file behavior analytics. This seamless integration helps users make safe decisions without leaving their inbox.

## Features

- Real-time malware scanning of Gmail attachments
- Integration with VirusTotal's comprehensive threat database
- Support for multiple file types (.doc, .docx, .pdf, .txt, .xls, .xlsx, .csv, .zip, .rar, .7z, .exe, etc)
- Color-coded results (green for safe, orange for suspicious, red for malicious)
- Detailed security reports
- Batch scanning of multiple attachments
- Privacy-focused (no file content storage)

## Technologies Used
- Languages: JavaScript, HTML, CSS
- APIs: VirusTotal Public API
- Tools: Chrome Extension APIs, Gmail DOM manipulation
- Concepts: File handling, asynchronous requests, UI interaction, REST API integration

## Demo
1) For Single Attachment

Scan Button:   
![Screenshot 2025-04-23 005846](https://github.com/user-attachments/assets/780f9b3f-f7d7-4e18-b07b-78c911570251)

Scanning:
![Screenshot 2025-04-23 010100](https://github.com/user-attachments/assets/e82c9c3c-2787-42a9-af66-27d3d1e78595)

Color Coded Result (Green - Safe):
![Screenshot 2025-04-23 010250](https://github.com/user-attachments/assets/48f70a23-c52e-4c05-acb9-f27dd42f9822)

Scan Report:
![Screenshot 2025-04-23 010417](https://github.com/user-attachments/assets/e6fcab74-5d2f-4ad7-a08b-21082c07a6aa)

Full VirusTotal Report:
![image](https://github.com/user-attachments/assets/25914ca4-274c-4888-8e21-6e2184928808)

2) For Multiple Attachment

Scan All Button:
![image](https://github.com/user-attachments/assets/6e7dcaf1-1e47-4a06-a32f-70655927e3bf)

Scanning:
![image](https://github.com/user-attachments/assets/ab1a1512-9aca-480e-8e53-6a85ea038bb5)

Color Coded Result:
![image](https://github.com/user-attachments/assets/9070b5bd-f54b-4dd6-9762-1a41c8959707)

Individual Scan Report for each Attachment:
![image](https://github.com/user-attachments/assets/e78619aa-ed27-4eeb-8695-a7562acace0b)

Full VirusTotal Report:
![image](https://github.com/user-attachments/assets/25914ca4-274c-4888-8e21-6e2184928808)

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

