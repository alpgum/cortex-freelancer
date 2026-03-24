#!/bin/bash

# Setup script for gRPC-Web client code generation and proxy setup
# CFX-027: gRPC Streaming Implementation

set -e

echo "Setting up gRPC-Web for Cortex Freelancer..."

# Check if we're in the right directory
if [ ! -f "proto/chat.proto" ]; then
    echo "Error: proto/chat.proto not found. Run from project root."
    exit 1
fi

# Create output directory for generated files
mkdir -p app/js/grpc-generated

# Generate JavaScript gRPC-Web client code
echo "Generating gRPC-Web client code..."

# Method 1: Using protoc with grpc-web plugin (preferred)
if command -v protoc >/dev/null 2>&1 && command -v protoc-gen-grpc-web >/dev/null 2>&1; then
    echo "Using protoc with grpc-web plugin..."
    protoc -I=proto \
        --js_out=import_style=commonjs:app/js/grpc-generated \
        --grpc-web_out=import_style=commonjs,mode=grpcwebtext:app/js/grpc-generated \
        proto/chat.proto
    echo "✓ Generated client code in app/js/grpc-generated/"
else
    echo "Warning: protoc or protoc-gen-grpc-web not found."
    echo "Install via:"
    echo "  brew install protobuf"
    echo "  npm install -g grpc-web"
    echo "Or download from: https://github.com/grpc/grpc-web/releases"
    echo ""
    echo "For now, using our custom client implementation..."
fi

# Method 2: Download pre-built grpc-web runtime
echo "Downloading gRPC-Web runtime..."
GRPC_WEB_VERSION="1.4.2"
GRPC_WEB_URL="https://github.com/grpc/grpc-web/releases/download/${GRPC_WEB_VERSION}/grpcwebtext.js"

if command -v curl >/dev/null 2>&1; then
    curl -L -o app/js/grpc-generated/grpcwebtext.js "$GRPC_WEB_URL"
    echo "✓ Downloaded gRPC-Web runtime"
else
    echo "Warning: curl not found. Download manually:"
    echo "  $GRPC_WEB_URL -> app/js/grpc-generated/grpcwebtext.js"
fi

# Setup proxy options
echo ""
echo "Choose a proxy method:"
echo "1. Envoy (Docker) - Production ready, full features"
echo "2. grpcwebproxy (Go binary) - Simple, development friendly"
echo "3. Manual setup"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "Setting up Envoy proxy with Docker..."
        if command -v docker >/dev/null 2>&1; then
            echo "Starting Envoy proxy container..."
            docker run -d \
                --name cortex-grpc-proxy \
                -p 8080:8080 \
                -p 9901:9901 \
                -v "$(pwd)/grpc-proxy-config.yaml:/etc/envoy/envoy.yaml" \
                envoyproxy/envoy:v1.24-latest
            echo "✓ Envoy proxy running on http://localhost:8080"
            echo "✓ Admin interface: http://localhost:9901"
        else
            echo "Error: Docker not found. Install Docker Desktop or use option 2."
            exit 1
        fi
        ;;
    2)
        echo "Setting up grpcwebproxy..."
        if command -v grpcwebproxy >/dev/null 2>&1; then
            echo "Starting grpcwebproxy..."
            grpcwebproxy \
                --backend_addr=localhost:50051 \
                --run_tls_server=false \
                --allow_all_origins \
                --server_http_debug_port=8080 &
            PROXY_PID=$!
            echo "✓ grpcwebproxy running on http://localhost:8080 (PID: $PROXY_PID)"
            echo "  To stop: kill $PROXY_PID"
        else
            echo "Installing grpcwebproxy..."
            if command -v go >/dev/null 2>&1; then
                go install github.com/improbable-eng/grpc-web/go/grpcwebproxy@latest
                echo "✓ grpcwebproxy installed. Run again to start."
            else
                echo "Error: Go not found. Install Go or use option 1 (Envoy)."
                echo "Download: https://golang.org/dl/"
                exit 1
            fi
        fi
        ;;
    3)
        echo "Manual setup selected."
        echo "Configure your proxy to forward HTTP requests to gRPC server:"
        echo "  Browser -> HTTP/gRPC-Web (port 8080) -> Proxy -> gRPC (port 50051)"
        ;;
    *)
        echo "Invalid choice. Manual setup selected."
        ;;
esac

# Create browser test page
echo ""
echo "Creating browser test page..."
cat > app/grpc-test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Cortex gRPC-Web Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        textarea { width: 100%; height: 100px; margin: 10px 0; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .output { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 4px; min-height: 200px; overflow-y: auto; }
        .status { padding: 5px 10px; margin: 5px 0; border-radius: 4px; }
        .status.connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.disconnected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .token { display: inline; margin: 0; }
        .error { color: #dc3545; background: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Cortex gRPC-Web Test Client</h1>
        
        <div id="status" class="status disconnected">Disconnected</div>
        
        <div>
            <label>Server URL:</label>
            <input type="text" id="serverUrl" value="http://localhost:8080" style="width: 300px; margin: 10px;">
            <button onclick="connect()">Connect</button>
            <button onclick="checkHealth()">Health Check</button>
        </div>
        
        <div>
            <label>Message:</label>
            <textarea id="messageInput" placeholder="Ask Cortex about freelancing...">How do I price my services as a freelancer?</textarea>
            <button onclick="sendMessage()">Send Message</button>
            <button onclick="cancelAll()">Cancel All</button>
        </div>
        
        <div class="output" id="output"></div>
        
        <div>
            <h3>Debug Info</h3>
            <div id="debugInfo" class="output" style="font-family: monospace; font-size: 12px;"></div>
        </div>
    </div>

    <!-- Load gRPC-Web runtime -->
    <script src="/app/js/grpc-generated/grpcwebtext.js"></script>
    <!-- Load our client -->
    <script src="/grpc-web-client.js"></script>
    
    <script>
        let client = null;
        let messageCount = 0;
        
        function connect() {
            const serverUrl = document.getElementById('serverUrl').value;
            const status = document.getElementById('status');
            
            if (client) {
                client.disconnect();
            }
            
            try {
                client = new CortexGrpcClient({
                    serverUrl: serverUrl,
                    enableDevtools: true
                });
                
                // Set up event listeners
                client.on('healthCheck', (data) => {
                    updateStatus(data.isConnected);
                    updateDebug('Health Check', data);
                });
                
                client.on('token', (data) => {
                    appendToken(data.token);
                });
                
                client.on('complete', (data) => {
                    appendOutput(`\n\n[Complete - ${data.responseTime}ms, ${data.totalTokens} tokens]\n`);
                    updateDebug('Complete', data);
                });
                
                client.on('thinking', (data) => {
                    appendOutput(`[${data.message}]\n`);
                });
                
                client.on('error', (data) => {
                    appendOutput(`\nERROR: ${data.error.message}\n`, 'error');
                    updateDebug('Error', data);
                });
                
                client.on('usage', (data) => {
                    updateDebug('Usage', data.usage);
                });
                
                appendOutput('Client initialized. Checking health...\n');
                
            } catch (error) {
                appendOutput(`Connection error: ${error.message}\n`, 'error');
                updateStatus(false);
            }
        }
        
        function checkHealth() {
            if (client) {
                client.checkHealth().catch(console.error);
            } else {
                appendOutput('No client connected.\n', 'error');
            }
        }
        
        async function sendMessage() {
            if (!client) {
                appendOutput('Connect to server first.\n', 'error');
                return;
            }
            
            const message = document.getElementById('messageInput').value.trim();
            if (!message) {
                appendOutput('Enter a message.\n', 'error');
                return;
            }
            
            messageCount++;
            appendOutput(`\n--- Message ${messageCount} ---\n`);
            appendOutput(`You: ${message}\n`);
            appendOutput(`Cortex: `);
            
            try {
                const result = await client.sendMessage(message);
                updateDebug('Request Started', { requestId: result.requestId, message });
            } catch (error) {
                appendOutput(`\nSend error: ${error.message}\n`, 'error');
            }
        }
        
        function cancelAll() {
            if (client) {
                client.cancelAllRequests();
                appendOutput('\n[All requests cancelled]\n');
            }
        }
        
        function updateStatus(connected) {
            const status = document.getElementById('status');
            status.className = `status ${connected ? 'connected' : 'disconnected'}`;
            status.textContent = connected ? 'Connected' : 'Disconnected';
        }
        
        function appendOutput(text, className = '') {
            const output = document.getElementById('output');
            const span = document.createElement('span');
            span.textContent = text;
            if (className) span.className = className;
            output.appendChild(span);
            output.scrollTop = output.scrollHeight;
        }
        
        function appendToken(token) {
            const output = document.getElementById('output');
            const span = document.createElement('span');
            span.textContent = token;
            span.className = 'token';
            output.appendChild(span);
            output.scrollTop = output.scrollHeight;
        }
        
        function updateDebug(event, data) {
            const debug = document.getElementById('debugInfo');
            const entry = document.createElement('div');
            entry.innerHTML = `[${new Date().toLocaleTimeString()}] ${event}: ${JSON.stringify(data, null, 2)}`;
            debug.appendChild(entry);
            debug.scrollTop = debug.scrollHeight;
            
            // Keep only last 10 entries
            while (debug.children.length > 10) {
                debug.removeChild(debug.firstChild);
            }
        }
        
        // Auto-connect on page load
        window.onload = () => {
            connect();
        };
    </script>
</body>
</html>
EOF

echo "✓ Created test page: app/grpc-test.html"

# Update package.json with gRPC dependencies
echo ""
echo "Updating package.json..."
if command -v jq >/dev/null 2>&1; then
    # Use jq for clean JSON manipulation
    jq '.dependencies |= . + {"@grpc/grpc-js": "^1.9.0", "@grpc/proto-loader": "^0.7.0", "grpc-web": "^1.4.0"}' package.json > package.json.tmp && mv package.json.tmp package.json
    echo "✓ Updated package.json"
else
    echo "Warning: jq not found. Manually add to package.json dependencies:"
    echo '  "@grpc/grpc-js": "^1.9.0",'
    echo '  "@grpc/proto-loader": "^0.7.0",'
    echo '  "grpc-web": "^1.4.0"'
fi

echo ""
echo "=== gRPC-Web Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Start the gRPC server:"
echo "   node grpc-server.js"
echo ""
echo "2. Start the web server (if not running):"
echo "   npm start"
echo ""
echo "3. Test in browser:"
echo "   http://localhost:3847/app/grpc-test.html"
echo ""
echo "4. Compare with existing implementations:"
echo "   http://localhost:3847/app/chat.html (WebSocket)"
echo ""
echo "Architecture:"
echo "  Browser -> gRPC-Web (port 8080) -> Proxy -> gRPC Server (port 50051) -> OpenClaw CLI"
echo ""
echo "Troubleshooting:"
echo "- Check server logs for errors"
echo "- Verify proxy is running: curl http://localhost:8080/healthz"  
echo "- Check browser console for gRPC-Web errors"
echo "- Ensure OpenClaw CLI is available: which openclaw"