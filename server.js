// server.js

const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { MasterPredictor } = require('./thuatoan.js');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

let apiResponseData = {
    id: "@Vinhmaycayuytins1", // <-- ĐÃ THAY ĐỔI
    phien: null,
    xuc_xac_1: null,
    xuc_xac_2: null,
    xuc_xac_3: null,
    tong: null,
    ket_qua: "",
    du_doan: "?",
    do_tin_cay: "0%",
    tong_dung: 0,
    tong_sai: 0,
    ty_le_thang_lich_su: "0%",
    pattern: "",
    tong_phien_da_phan_tich: 0
};

const MAX_HISTORY_SIZE = 1000;
let currentSessionId = null;
let lastPrediction = null; 
const fullHistory = []; 

const predictor = new MasterPredictor();

const WEBSOCKET_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Origin": "https://play.sun.win"
};
const RECONNECT_DELAY = 2500;
const PING_INTERVAL = 15000;

// <-- ĐÃ THAY ĐỔI
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

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;

            const { cmd, sid, d1, d2, d3, gBB } = data[1];

            if (cmd === 1008 && sid) {
                currentSessionId = sid;
            }

            if (cmd === 1003 && gBB) {
                if (!d1 || !d2 || !d3) return;

                const total = d1 + d2 + d3;
                const result = (total > 10) ? "Tài" : "Xỉu";
                
                let correctnessStatus = null;
                if (lastPrediction && lastPrediction !== "?") {
                    if (lastPrediction === result) {
                        apiResponseData.tong_dung++;
                        correctnessStatus = "ĐÚNG";
                    } else {
                        apiResponseData.tong_sai++;
                        correctnessStatus = "SAI";
                    }
                }

                const totalGames = apiResponseData.tong_dung + apiResponseData.tong_sai;
                apiResponseData.ty_le_thang_lich_su = totalGames === 0 ? "0%" : `${((apiResponseData.tong_dung / totalGames) * 100).toFixed(0)}%`;

                const historyEntry = { 
                    session: currentSessionId, d1, d2, d3, 
                    totalScore: total, result, 
                    prediction: lastPrediction,
                    correctness: correctnessStatus 
                };
                fullHistory.push(historyEntry);
                if (fullHistory.length > MAX_HISTORY_SIZE) fullHistory.shift();
                
                await predictor.updateData({ score: total, result: result });
                
                const predictionResult = await predictor.predict();
                
                let finalPrediction = "?";
                let predictionConfidence = "0%";
                
                if (predictionResult && predictionResult.prediction) {
                    finalPrediction = predictionResult.prediction;
                    predictionConfidence = `${(predictionResult.confidence * 100).toFixed(0)}%`;
                }

                apiResponseData.phien = currentSessionId;
                apiResponseData.xuc_xac_1 = d1;
                apiResponseData.xuc_xac_2 = d2;
                apiResponseData.xuc_xac_3 = d3;
                apiResponseData.tong = total;
                apiResponseData.ket_qua = result;
                apiResponseData.du_doan = finalPrediction;
                apiResponseData.do_tin_cay = predictionConfidence;
                apiResponseData.pattern = fullHistory.map(h => h.result === 'Tài' ? 'T' : 'X').join('');
                apiResponseData.tong_phien_da_phan_tich = fullHistory.length;

                lastPrediction = finalPrediction;
                currentSessionId = null;
                
                console.log(`Phiên #${apiResponseData.phien}: ${apiResponseData.tong} (${result}) | Dự đoán mới: ${finalPrediction} | Tin cậy: ${apiResponseData.do_tin_cay} | Tỷ lệ thắng: ${apiResponseData.ty_le_thang_lich_su}`);
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

// <-- ĐÃ THAY ĐỔI
app.get('/vinhmaycay', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(apiResponseData, null, 4));
});

app.get('/history', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    let html = `<style>
                    body{font-family:monospace;background-color:#121212;color:#e0e0e0;}
                    h2{color:#4e8af4;}
                    .entry{border-bottom:1px solid #444;padding:8px; margin-bottom: 5px; background-color:#1e1e1e; border-radius: 4px;}
                    .tai, .dung{color:#28a745; font-weight:bold;}
                    .xiu, .sai{color:#dc3545; font-weight:bold;}
                </style>
                <h2>Lịch sử ${fullHistory.length} phiên gần nhất</h2>`;

    if (fullHistory.length === 0) {
        html += '<p>Chưa có dữ liệu lịch sử.</p>';
    } else {
        [...fullHistory].reverse().forEach(h => {
            const resultClass = h.result === 'Tài' ? 'tai' : 'xiu';
            let statusHtml = '';
            if (h.correctness === "ĐÚNG") {
                statusHtml = ` <span class="dung">✅ ĐÚNG</span>`;
            } else if (h.correctness === "SAI") {
                statusHtml = ` <span class="sai">❌ SAI</span>`;
            }

            const predictionHtml = h.prediction && h.prediction !== "?"
                ? `- Dự đoán: <b>${h.prediction}</b>${statusHtml}<br/>`
                : '';

            html += `<div class="entry">
                        - Phiên: <b>${h.session}</b><br/>
                        ${predictionHtml}
                        - Kết quả: <span class="${resultClass}">${h.result}</span><br/>
                        - Xúc xắc: [${h.d1}]-[${h.d2}]-[${h.d3}] (Tổng: ${h.totalScore})
                     </div>`;
        });
    }
    res.send(html);
});

app.get('/', (req, res) => {
    // <-- ĐÃ THAY ĐỔI
    res.send(`<h2>🎯 API Phân Tích Sunwin Tài Xỉu</h2><p>Xem kết quả JSON: <a href="/vinhmaycay">/vinhmaycay</a></p><p>Xem lịch sử 1000 phiên gần nhất: <a href="/history">/history</a></p>`);
});

app.listen(PORT, () => {
    console.log(`[🌐] Server is running at http://localhost:${PORT}`);
    connectWebSocket();
});
