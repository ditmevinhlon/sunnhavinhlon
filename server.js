// server.js

const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// Cấu trúc dữ liệu trả về theo yêu cầu
let apiResponseData = {
    Phien: null,
    Xuc_xac_1: null,
    Xuc_xac_2: null,
    Xuc_xac_3: null,
    Tong: null,
    Ket_qua: "",
    id: '@vinhmaycayuytins1'
};

let currentSessionId = null;

const WEBSOCKET_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Origin": "https://play.sun.win"
};
const RECONNECT_DELAY = 2500;
const PING_INTERVAL = 15000;

const initialMessages = [
    [1,"MiniGame","GM_cudosinichippp","123123p",{"info":"{\"ipAddress\":\"2402:800:62cd:1a86:3e31:209c:4975:3bb\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJzaGluaWNoaWt1ZG85MjgiLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMTI5Njg2NjIsImFmZklkIjoiR0VNV0lOIiwiYmFubmVkIjpmYWxzZSwiYnJhbmQiOiJnZW0iLCJ0aW1lc3RhbXAiOjE3NTU0MzgzNDQ2MjYsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMjQwMjo4MDA6NjJjZDoxYTg2OjNlMzE6MjA5Yzo0OTc1OjNiYiIsIm11dGUiOmZhbHNlLCJhdmF0YXIiOiJodHRwczovL2ltYWdlcy5zd2luc2hvcC5uZXQvaW1hZ2VzL2F2YXRhci9hdmF0YXJfMDcucG5nIiwicGxhdGZvcm1JZCI6NSwidXNlcklkIjoiM2RmYjg4NDAtNTA3NS00NDYyLWJmYjQtYjA2MzJlZDIyMDRjIiwicmVnVGltZSI6MTc1NTQzODI3OTgyNCwicGhvbmUiOiIiLCJkZXBvc2l0IjpmYWxzZSwidXNlcm5hbWUiOiJHTV9jdWRvc2luaWNoaXBwcCJ9.HGWSrkZhZIRbEqWThGzivGKsnUsssRK8EdjdkO_K89s\",\"locale\":\"vi\",\"userId\":\"3dfb8840-5075-4462-bfb4-b0632ed2204c\",\"username\":\"GM_cudosinichippp\",\"timestamp\":1755438344626,\"refreshToken\":\"f31b90949e684a188c51caf54eec5cdf.0e0c660879b24b58bc021bb04a68a906\"}","signature":"829AFB26FFF0F0AA0AD1DFA694EEE31760C7DE1A268B505BBB2D52C01D1C6B4A08569826A86BEF30104234BCC9D76834DCBC480AE6422EC80D46BDFBAC52FCEBA926301FB8F8F2FD0BC06BEB978A649D4156C88D127E2967F5EFB3EA60240FAAC219E1A246DFB315AA84CFB3C8F939E79856A6B4C1FA701B184FEC1EA52AAA5D"}],
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

let ws = null;
let pingInterval = null;
let reconnectTimeout = null;

function connectWebSocket() {
    if (ws) {
        ws.removeAllListeners();
        ws.close();
    }
    ws = new WebSocket(WEBSOCKET_URL, { headers: WS_HEADERS });

    ws.on('open', () => {
        console.log('[✅] WebSocket connected.');
        initialMessages.forEach((msg, i) => {
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
            }, i * 600);
        });
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, PING_INTERVAL);
    });

    ws.on('pong', () => console.log('[📶] Ping OK.'));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;

            const { cmd, sid, d1, d2, d3, gBB } = data[1];

            // Lấy mã phiên mới
            if (cmd === 1008 && sid) {
                currentSessionId = sid;
            }

            // Lấy kết quả của phiên vừa kết thúc
            if (cmd === 1003 && gBB) {
                if (d1 == null || d2 == null || d3 == null) return;

                const total = d1 + d2 + d3;
                const result = (total > 10) ? "Tài" : "Xỉu";
                
                // Cập nhật dữ liệu để trả về qua API
                apiResponseData.Phien = currentSessionId;
                apiResponseData.Xuc_xac_1 = d1;
                apiResponseData.Xuc_xac_2 = d2;
                apiResponseData.Xuc_xac_3 = d3;
                apiResponseData.Tong = total;
                apiResponseData.Ket_qua = result;

                console.log(`[🎲] Cập nhật phiên #${apiResponseData.Phien}: ${d1}-${d2}-${d3} -> Tổng ${apiResponseData.Tong} (${apiResponseData.Ket_qua})`);
                
                // Reset mã phiên để chờ phiên tiếp theo
                currentSessionId = null;
            }
        } catch (e) {
            console.error('[❌] Lỗi xử lý message:', e.message);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[🔌] WebSocket closed. Code: ${code}, Reason: ${reason.toString()}. Reconnecting...`);
        clearInterval(pingInterval);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY);
    });

    ws.on('error', (err) => {
        console.error('[❌] WebSocket error:', err.message);
        ws.close();
    });
}

// Endpoint API để lấy dữ liệu
app.get('/vinhmaycay', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(apiResponseData, null, 4));
});

// Endpoint gốc
app.get('/', (req, res) => {
    res.send(`<h2>🎯 API Lấy Dữ Liệu Sunwin Tài Xỉu</h2><p>Xem kết quả JSON: <a href="/vinhmaycay">/vinhmaycay</a></p>`);
});

app.listen(PORT, () => {
    console.log(`[🌐] Server is running at http://localhost:${PORT}`);
    connectWebSocket();
});
