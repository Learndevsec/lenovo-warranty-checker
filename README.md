# Lenovo Warranty Lookup Tool

A complete full-stack application for checking warranty status of multiple Lenovo devices using their serial numbers. Built with TypeScript, Express.js, and modern web technologies.

## Features

- **Batch Warranty Lookup**: Check warranty status for up to 50 devices at once
- **File Upload Support**: Upload CSV/TXT files containing serial numbers
- **Manual Entry**: Type or paste serial numbers directly
- **Real-time Processing**: Live progress updates during warranty checks
- **Advanced Filtering**: Filter results by warranty status and search
- **Export Functionality**: Download results as CSV
- **Responsive Design**: Works on desktop and mobile devices
- **Professional UI**: Clean, modern interface with Lenovo-inspired design
- **Rate Limiting**: Built-in protection against API abuse
- **Caching**: Intelligent caching to reduce redundant requests

## Tech Stack

### Backend
- **Node.js** with **TypeScript**
- **Express.js** web framework
- **Puppeteer** for web scraping Lenovo's warranty pages
- **Multer** for file uploads
- **Node-cache** for warranty data caching
- **Rate-limiter-flexible** for API protection
- **Helmet** for security headers
- **CORS** for cross-origin requests

### Frontend
- **Vanilla JavaScript** (ES6+)
- **Modern CSS** with CSS Grid and Flexbox
- **Responsive Design** with mobile-first approach
- **Progressive Enhancement**
- **File Drag & Drop API**
- **Fetch API** for AJAX requests

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd lenovo-warranty-checker
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Build TypeScript**
```bash
npm run build
```

5. **Start the application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3001`

## Project Structure

```
lenovo-warranty-checker/
├── src/
│   ├── server.ts              # Main Express server
│   ├── types.ts               # TypeScript interfaces
│   ├── services/
│   │   └── warranty-service.ts # Warranty lookup logic
│   └── routes/
│       ├── warranty.ts        # Warranty API routes
│       └── upload.ts          # File upload routes
├── public/
│   ├── index.html            # Main HTML file
│   ├── styles.css            # Application styles
│   └── app.js                # Frontend JavaScript
├── dist/                     # Compiled TypeScript
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### Warranty Checking
- `POST /api/warranty/check` - Check warranty for multiple serial numbers
- `GET /api/warranty/check/:serialNumber` - Check single warranty
- `GET /api/warranty/stats` - Get system statistics

### File Upload
- `POST /api/upload/parse` - Parse uploaded file for serial numbers

### System
- `GET /api/health` - Health check endpoint

## Usage

### Web Interface

1. **File Upload Method**:
   - Click "File Upload" tab
   - Drag and drop or click to select a CSV/TXT file
   - File should contain one serial number per line
   - System automatically parses and validates serial numbers

2. **Manual Entry Method**:
   - Click "Manual Entry" tab
   - Enter serial numbers (one per line or comma-separated)
   - Click "Check Warranty" to begin processing

3. **View Results**:
   - Results display in a sortable, filterable table
   - Summary cards show warranty status breakdown
   - Export results as CSV for record keeping

### API Usage

**Check Multiple Warranties:**
```bash
curl -X POST http://localhost:3001/api/warranty/check \
  -H "Content-Type: application/json" \
  -d '{"serialNumbers": ["PF1ABCDE", "PF2FGHIJ"]}'
```

**Check Single Warranty:**
```bash
curl http://localhost:3001/api/warranty/check/PF1ABCDE
```

## Serial Number Format

- **Length**: 6-15 characters
- **Characters**: Alphanumeric only (A-Z, 0-9)
- **Case**: Automatically converted to uppercase
- **Examples**: `PF1ABCDE`, `PC123456`, `YT789ABC`

## File Formats

### CSV Files
```csv
PF1ABCDE
PF2FGHIJ
PF3KLMNO
```

### TXT Files
```
PF1ABCDE
PF2FGHIJ
PF3KLMNO
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3001` |
| `RATE_LIMIT_POINTS` | Requests per hour | `100` |
| `CACHE_TTL` | Cache time in seconds | `3600` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `5242880` |
| `MAX_SERIAL_NUMBERS` | Max serials per request | `50` |

### Customization

**Rate Limiting**: Adjust `RATE_LIMIT_POINTS` and `RATE_LIMIT_DURATION` in `.env`

**Caching**: Modify `CACHE_TTL` to change how long warranty data is cached

**File Limits**: Update `MAX_FILE_SIZE` and `MAX_SERIAL_NUMBERS` as needed

## Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Production server
npm start

# Type checking
npx tsc --noEmit
```

### Adding Features

1. **New API Endpoints**: Add routes in `src/routes/`
2. **Warranty Logic**: Modify `src/services/warranty-service.ts`
3. **Frontend Features**: Update `public/app.js` and `public/styles.css`
4. **Types**: Add interfaces to `src/types.ts`

## Deployment

### Production Setup

1. **Set environment to production**
```bash
export NODE_ENV=production
```

2. **Install production dependencies**
```bash
npm ci --only=production
```

3. **Build application**
```bash
npm run build
```

4. **Start with process manager**
```bash
# Using PM2
npm install -g pm2
pm2 start dist/server.js --name "lenovo-warranty"

# Using systemd (Linux)
sudo systemctl start lenovo-warranty
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY public/ ./public/
EXPOSE 3001
CMD ["npm", "start"]
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Security Considerations

- **Rate Limiting**: Prevents API abuse
- **Input Validation**: All inputs are sanitized
- **CORS Protection**: Configurable allowed origins
- **Security Headers**: Helmet.js adds security headers
- **File Upload Limits**: Size and type restrictions
- **No Data Storage**: No persistent warranty data storage

## Troubleshooting

### Common Issues

**"Browser launch failed" Error:**
```bash
# Install Chromium dependencies (Linux)
sudo apt-get install -y chromium-browser

# Or use system Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

**"Rate limit exceeded" Error:**
- Wait for the rate limit window to reset
- Reduce the number of concurrent requests
- Adjust rate limiting configuration

**"File parsing failed" Error:**
- Ensure file contains only serial numbers
- Check file encoding (UTF-8 recommended)
- Verify serial number format (6-15 alphanumeric)

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=debug
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

This tool is not affiliated with Lenovo Group. It accesses publicly available warranty information from Lenovo's support website. Use responsibly and in accordance with Lenovo's terms of service.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the GitHub issues
3. Create a new issue with detailed information

---

**Version**: 1.0.0  
**Last Updated**: August 2025