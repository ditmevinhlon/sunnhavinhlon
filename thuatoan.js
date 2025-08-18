/**
 * thuatoan.js
 * Phiên bản "Bắt Cầu Thông Minh".
 * Ưu tiên 1: Bắt cầu bệt (3+ phiên giống nhau).
 * Ưu tiên 2: Bắt cầu 1-1 (xen kẽ).
 * Mặc định: DỰ ĐOÁN NGẪU NHIÊN.
 */

// --- CÁC HÀM PHÂN TÍCH (Không được sử dụng trong phiên bản này) ---
// Giữ lại các hàm này nếu bạn muốn quay lại thuật toán cũ sau này.
function analyzeStreak(history) {
    if (history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };
    let streak = 1;
    const currentResult = history[history.length - 1].result;
    for (let i = history.length - 2; i >= 0; i--) {
        if (history[i].result === currentResult) streak++; else break;
    }
    let breakProb = 0.0;
    if (streak >= 7) breakProb = 0.90;
    else if (streak >= 5) breakProb = 0.75 + (streak - 5) * 0.07;
    else if (streak >= 3) breakProb = 0.40 + (streak - 3) * 0.1;
    return { streak, currentResult, breakProb };
}
function analyzeStatistics(history) {
    const results = history.map(h => h.result);
    const scores = history.map(h => h.totalScore);
    const taiCount = results.filter(r => r === 'Tài').length;
    const xiuCount = results.length - taiCount;
    const taiRatio = taiCount / results.length;
    const switches = results.slice(1).reduce((count, curr, idx) => count + (curr !== results[idx] ? 1 : 0), 0);
    const switchRate = results.length > 1 ? switches / (results.length - 1) : 0;
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const scoreStdDev = Math.sqrt(scores.map(x => Math.pow(x - avgScore, 2)).reduce((a, b) => a + b) / scores.length);
    return { taiCount, xiuCount, taiRatio, imbalance: Math.abs(taiCount - xiuCount) / results.length, switchRate, avgScore, scoreStdDev };
}
function analyzePatterns(history, patternLength = 3) {
    const results = history.map(h => h.result);
    if (results.length < patternLength + 1) return { prediction: null, confidence: 0 };
    const lastPattern = results.slice(-patternLength).join('-');
    const occurrences = { 'Tài': 0, 'Xỉu': 0, 'total': 0 };
    for (let i = 0; i <= results.length - (patternLength + 1); i++) {
        const currentSlice = results.slice(i, i + patternLength).join('-');
        if (currentSlice === lastPattern) {
            const nextResult = results[i + patternLength];
            occurrences[nextResult]++;
            occurrences.total++;
        }
    }
    if (occurrences.total < 2) return { prediction: null, confidence: 0, reason: "Không tìm thấy mẫu hình lặp lại đủ mạnh." };
    const taiProb = occurrences['Tài'] / occurrences.total;
    const xiuProb = occurrences['Xỉu'] / occurrences.total;
    const prediction = taiProb > xiuProb ? 'Tài' : 'Xỉu';
    const confidence = Math.max(taiProb, xiuProb);
    return { prediction, confidence, reason: `Mẫu [${lastPattern}] đã xuất hiện ${occurrences.total} lần, thường dẫn đến ${prediction} (${(confidence * 100).toFixed(0)}%)` };
}

// --- CLASS DỰ ĐOÁN CHÍNH ---

class MasterPredictor {
    constructor() {
        this.history = [];
        this.MAX_HISTORY_SIZE = 200;
    }

    async updateData(newResult) {
        const formattedResult = {
            totalScore: newResult.score,
            result: newResult.result
        };
        this.history.push(formattedResult);

        if (this.history.length > this.MAX_HISTORY_SIZE) {
            this.history.shift();
        }
    }

    async predict() {
        // BƯỚC 1: KIỂM TRA ĐIỀU KIỆN (Yêu cầu 5 phiên)
        if (this.history.length < 5) {
            return {
                prediction: "?",
                confidence: 0,
                reason: `Đang chờ đủ 5 phiên để bắt đầu. Hiện có: ${this.history.length} phiên.`
            };
        }

        // Lấy 3 kết quả gần nhất để phân tích cầu
        const last3Results = this.history.slice(-3).map(h => h.result);
        const last = last3Results[2];
        const secondLast = last3Results[1];
        const thirdLast = last3Results[0];

        // --- ƯU TIÊN 1: KIỂM TRA CẦU BỆT ---
        if (last === secondLast && secondLast === thirdLast) {
            const prediction = last; // Đi theo cầu
            const confidence = 0.85; // Độ tin cậy cao khi có cầu bệt
            const reason = `Phát hiện cầu bệt ${prediction} (3+ phiên), đi theo cầu.`;
            return { prediction, confidence, reason };
        }

        // --- ƯU TIÊN 2: KIỂM TRA CẦU 1-1 ---
        // Ví dụ: Tài - Xỉu - Tài. (last !== secondLast && last === thirdLast)
        if (last !== secondLast && last === thirdLast) {
            const prediction = secondLast; // Dự đoán kết quả tiếp theo để tạo thành chuỗi 1-1
            const confidence = 0.80; // Độ tin cậy cao
            const reason = `Phát hiện cầu 1-1 (${thirdLast}-${secondLast}-${last}), đi theo cầu.`;
            return { prediction, confidence, reason };
        }

        // --- MẶC ĐỊNH MỚI: DỰ ĐOÁN NGẪU NHIÊN ---
        // Nếu không có cầu bệt hay cầu 1-1 rõ ràng, sẽ dự đoán ngẫu nhiên.
        const prediction = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        const confidence = 0.50; // 50% vì là ngẫu nhiên
        const reason = `Không có cầu rõ ràng, dự đoán ngẫu nhiên.`;
        
        return { prediction, confidence, reason };
    }
}

module.exports = { MasterPredictor };
