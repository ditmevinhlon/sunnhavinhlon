/**
 * thuatoan.js
 * Thuật toán dự đoán Tài/Xỉu được đóng gói trong class MasterPredictor.
 * Tương thích hoàn toàn với server.js được cung cấp.
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. server.js sẽ tạo một instance: `new MasterPredictor()`.
 * 2. Sau mỗi phiên, server gọi `predictor.updateData({ score: ..., result: ... })` để cung cấp dữ liệu mới.
 * 3. Ngay sau đó, server gọi `predictor.predict()` để lấy dự đoán cho phiên tiếp theo.
 */

// --- CÁC HÀM PHÂN TÍCH CỐT LÕI (HELPERS) ---
// Các hàm này được đặt bên ngoài class để giữ cho logic được tách bạch.

/**
 * Phân tích chuỗi (streak) hiện tại và tính toán xác suất bẻ cầu.
 * @param {Array<Object>} history - Lịch sử đã chuẩn hóa.
 * @returns {Object} { streak: number, currentResult: string, breakProb: number }
 */
function analyzeStreak(history) {
    if (history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };

    let streak = 1;
    const currentResult = history[history.length - 1].result;
    for (let i = history.length - 2; i >= 0; i--) {
        if (history[i].result === currentResult) {
            streak++;
        } else {
            break;
        }
    }

    let breakProb = 0.0;
    if (streak >= 7) {
        breakProb = 0.90;
    } else if (streak >= 5) {
        breakProb = 0.75 + (streak - 5) * 0.07;
    } else if (streak >= 3) {
        breakProb = 0.40 + (streak - 3) * 0.1;
    }

    return { streak, currentResult, breakProb };
}

/**
 * Phân tích các chỉ số thống kê trong một khoảng lịch sử nhất định.
 * @param {Array<Object>} history - Lịch sử đã chuẩn hóa.
 * @returns {Object} Các chỉ số thống kê.
 */
function analyzeStatistics(history) {
    const results = history.map(h => h.result);
    const scores = history.map(h => h.totalScore);

    const taiCount = results.filter(r => r === 'Tài').length;
    const xiuCount = results.length - taiCount;
    const taiRatio = taiCount / results.length;
    const switches = results.slice(1).reduce((count, curr, idx) => count + (curr !== results[idx] ? 1 : 0), 0);
    const switchRate = results.length > 1 ? switches / (results.length - 1) : 0;
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const scoreStdDev = Math.sqrt(
        scores.map(x => Math.pow(x - avgScore, 2)).reduce((a, b) => a + b) / scores.length
    );

    return {
        taiCount,
        xiuCount,
        taiRatio,
        imbalance: Math.abs(taiCount - xiuCount) / results.length,
        switchRate,
        avgScore,
        scoreStdDev,
    };
}

/**
 * Phân tích các mẫu hình (pattern) lặp lại.
 * @param {Array<Object>} history - Lịch sử đã chuẩn hóa.
 * @param {number} patternLength - Độ dài của mẫu hình cần tìm.
 * @returns {Object} { prediction: string, confidence: number, reason: string }
 */
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

    if (occurrences.total < 2) {
        return { prediction: null, confidence: 0, reason: "Không tìm thấy mẫu hình lặp lại đủ mạnh." };
    }

    const taiProb = occurrences['Tài'] / occurrences.total;
    const xiuProb = occurrences['Xỉu'] / occurrences.total;
    const prediction = taiProb > xiuProb ? 'Tài' : 'Xỉu';
    const confidence = Math.max(taiProb, xiuProb);

    return {
        prediction,
        confidence,
        reason: `Mẫu [${lastPattern}] đã xuất hiện ${occurrences.total} lần, thường dẫn đến ${prediction} (${(confidence * 100).toFixed(0)}%)`
    };
}

// --- CLASS DỰ ĐOÁN CHÍNH ---

class MasterPredictor {
    constructor() {
        this.history = [];
        this.MAX_HISTORY_SIZE = 200; // Giới hạn lịch sử để tối ưu bộ nhớ
    }

    /**
     * Cập nhật lịch sử với kết quả của phiên vừa kết thúc.
     * @param {Object} newResult - Dữ liệu phiên mới, ví dụ: { score: 12, result: 'Tài' }
     */
    async updateData(newResult) {
        const formattedResult = {
            totalScore: newResult.score,
            result: newResult.result
        };
        this.history.push(formattedResult);

        // Giữ cho lịch sử không quá dài
        if (this.history.length > this.MAX_HISTORY_SIZE) {
            this.history.shift();
        }
    }

    /**
     * Thực hiện dự đoán cho phiên tiếp theo dựa trên lịch sử hiện có.
     * @returns {Promise<Object>} - Đối tượng dự đoán, ví dụ: { prediction: 'Xỉu', confidence: 0.85, reason: '...' }
     */
    async predict() {
        // BƯỚC 1: KIỂM TRA ĐIỀU KIỆN
        if (this.history.length < 20) {
            return {
                prediction: "?",
                confidence: 0,
                reason: `Đang chờ đủ 20 phiên để phân tích. Hiện có: ${this.history.length} phiên.`
            };
        }
        
        const last20 = this.history.slice(-20);

        // BƯỚC 2: CHẠY CÁC MODULE PHÂN TÍCH
        const streakInfo = analyzeStreak(this.history);
        const stats = analyzeStatistics(last20);
        const pattern3 = analyzePatterns(last20, 3);
        const pattern2 = analyzePatterns(last20, 2);

        // BƯỚC 3: TỔNG HỢP KẾT QUẢ VÀ TÍNH ĐIỂM
        let taiScore = 0;
        let xiuScore = 0;
        const reasons = [];

        // 1. Logic về chuỗi (Streak Logic)
        if (streakInfo.streak >= 3) {
            const isBreaking = streakInfo.breakProb > 0.5;
            const breakWeight = 1.5 * streakInfo.breakProb;
            const followWeight = 1.2 * (1 - streakInfo.breakProb);
            const breakPrediction = streakInfo.currentResult === 'Tài' ? 'Xỉu' : 'Tài';

            if (isBreaking) {
                reasons.push(`[Bẻ Cầu] Chuỗi ${streakInfo.streak} ${streakInfo.currentResult} có xác suất bẻ cao (${(streakInfo.breakProb * 100).toFixed(0)}%).`);
                if (breakPrediction === 'Tài') taiScore += breakWeight; else xiuScore += breakWeight;
            } else {
                reasons.push(`[Theo Cầu] Chuỗi ${streakInfo.streak} ${streakInfo.currentResult} đang ổn định, ưu tiên theo.`);
                if (streakInfo.currentResult === 'Tài') taiScore += followWeight; else xiuScore += followWeight;
            }
        }

        // 2. Logic về Mẫu hình (Pattern Logic)
        if (pattern3.confidence > 0.8) {
            reasons.push(`[Mẫu 3] ${pattern3.reason}`);
            if (pattern3.prediction === 'Tài') taiScore += 1.2 * pattern3.confidence; else xiuScore += 1.2 * pattern3.confidence;
        }
        if (pattern2.confidence > 0.7) {
            reasons.push(`[Mẫu 2] ${pattern2.reason}`);
            if (pattern2.prediction === 'Tài') taiScore += 1.0 * pattern2.confidence; else xiuScore += 1.0 * pattern2.confidence;
        }

        // 3. Logic về Thống kê (Statistical Logic)
        const volatilityFactor = stats.scoreStdDev > 3.0 ? 0.7 : 1.0;
        if (volatilityFactor < 1.0) {
            reasons.push(`[Thận trọng] Thị trường biến động cao (độ lệch điểm: ${stats.scoreStdDev.toFixed(1)}), giảm độ tin cậy.`);
        }

        if (stats.imbalance > 0.4) {
            const dominant = stats.taiCount > stats.xiuCount ? 'Tài' : 'Xỉu';
            reasons.push(`[Cân Bằng] ${dominant} đang chiếm ưu thế lớn (${(stats.taiRatio * 100).toFixed(0)}%), dự đoán xu hướng ngược lại.`);
            if (dominant === 'Tài') xiuScore += 0.8 * stats.imbalance; else taiScore += 0.8 * stats.imbalance;
        }

        if (stats.switchRate > 0.65 && streakInfo.streak === 1) {
            const lastResult = this.history[this.history.length - 1].result;
            reasons.push(`[Cầu Nhảy] Tỷ lệ chuyển đổi cao (${(stats.switchRate * 100).toFixed(0)}%), ưu tiên bẻ.`);
            if (lastResult === 'Tài') xiuScore += 0.9; else taiScore += 0.9;
        }

        // 4. Các quy tắc đặc biệt
        const last3results = this.history.slice(-3).map(h => h.result).join(',');
        if (last3results === 'Tài,Xỉu,Tài') {
            reasons.push('[Quy tắc 1-1] Phát hiện mẫu T-X-T, dự đoán Xỉu.');
            xiuScore += 1.1;
        } else if (last3results === 'Xỉu,Tài,Xỉu') {
            reasons.push('[Quy tắc 1-1] Phát hiện mẫu X-T-X, dự đoán Tài.');
            taiScore += 1.1;
        }

        // BƯỚC 4: RA QUYẾT ĐỊNH CUỐI CÙNG
        taiScore *= volatilityFactor;
        xiuScore *= volatilityFactor;

        let finalPrediction;
        let confidence;

        if (taiScore === 0 && xiuScore === 0) {
            finalPrediction = this.history[this.history.length - 1].result === 'Tài' ? 'Xỉu' : 'Tài';
            confidence = 0.40; // 40%
            reasons.push('[Dự phòng] Không có tín hiệu rõ ràng, dự đoán ngược lại kết quả gần nhất.');
        } else {
            finalPrediction = taiScore > xiuScore ? 'Tài' : 'Xỉu';
            const totalScore = taiScore + xiuScore;
            const confidenceScore = totalScore > 0 ? Math.abs(taiScore - xiuScore) / totalScore : 0;
            confidence = 0.50 + confidenceScore * 0.45; // Chuyển đổi thành 0.5 -> 0.95
        }

        return {
            prediction: finalPrediction,
            confidence: Math.min(confidence, 0.95), // Giới hạn độ tin cậy và trả về dạng số thập phân
            reason: reasons.length > 0 ? reasons.join(' | ') : "Không có lý do cụ thể."
        };
    }
}

// Export class để server.js có thể require()
module.exports = { MasterPredictor };
