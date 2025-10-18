// Zoom ve Calendly Toplantı Takip Sistemi
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');

const app = express();
app.use(express.json());

// Port ayarı - Render otomatik verecek
const PORT = process.env.PORT || 3000;

// Veritabanı - SQLite
const db = new sqlite3.Database(':memory:'); // Render'da kalıcı değil ama test için yeterli

// Tablo oluştur
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS meetings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id TEXT,
            host_email TEXT,
            participant_name TEXT,
            status TEXT DEFAULT 'scheduled',
            start_time TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Veritabanı hazır');
});

// Ana sayfa - Dashboard
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Toplantı Takip Sistemi</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 {
                    color: #333;
                    margin-bottom: 10px;
                    font-size: 2.5em;
                }
                .subtitle {
                    color: #666;
                    margin-bottom: 30px;
                }
                .status-box {
                    background: #f0f0f0;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 20px 0;
                }
                .status-box h2 {
                    color: #667eea;
                    margin-bottom: 10px;
                }
                .endpoint {
                    background: #333;
                    color: #0f0;
                    padding: 10px;
                    border-radius: 5px;
                    font-family: 'Courier New', monospace;
                    margin: 10px 0;
                    word-break: break-all;
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 30px 0;
                }
                .stat-card {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                }
                .stat-number {
                    font-size: 2.5em;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                button {
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 25px;
                    font-size: 16px;
                    cursor: pointer;
                    margin: 10px;
                    transition: transform 0.2s;
                }
                button:hover {
                    transform: translateY(-2px);
                    background: #764ba2;
                }
                .meetings-list {
                    background: #f9f9f9;
                    border-radius: 10px;
                    padding: 20px;
                    margin-top: 20px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th {
                    background: #667eea;
                    color: white;
                    padding: 10px;
                    text-align: left;
                }
                td {
                    padding: 10px;
                    border-bottom: 1px solid #ddd;
                }
                tr:hover {
                    background: #f0f0f0;
                }
                .success {
                    color: green;
                    font-weight: bold;
                }
                .warning {
                    color: orange;
                    font-weight: bold;
                }
                .error {
                    color: red;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Toplantı Takip Sistemi</h1>
                <p class="subtitle">Zoom ve Calendly entegrasyonu ile otomatik takip</p>
                
                <div class="status-box">
                    <h2>✅ Sistem Aktif</h2>
                    <p>Webhook URL'leriniz:</p>
                    <div class="endpoint" id="webhookUrl">
                        Zoom: <span id="zoomUrl"></span><br>
                        Calendly: <span id="calendlyUrl"></span>
                    </div>
                </div>
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number" id="totalMeetings">0</div>
                        <div>Toplam Toplantı</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="activeMeetings">0</div>
                        <div>Aktif Toplantı</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="todayMeetings">0</div>
                        <div>Bugünkü Toplantı</div>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <button onclick="testZoom()">🎥 Zoom Webhook Test</button>
                    <button onclick="testCalendly()">📅 Calendly Webhook Test</button>
                    <button onclick="refreshData()">🔄 Verileri Yenile</button>
                </div>
                
                <div class="meetings-list">
                    <h3>📊 Son Toplantılar</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Tarih/Saat</th>
                                <th>Toplantı ID</th>
                                <th>Host</th>
                                <th>Katılımcı</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody id="meetingsTable">
                            <tr>
                                <td colspan="5" style="text-align: center; color: #999;">
                                    Henüz toplantı kaydı yok
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <script>
                // Sayfa yüklendiğinde URL'leri göster
                window.onload = function() {
                    const baseUrl = window.location.origin;
                    document.getElementById('zoomUrl').textContent = baseUrl + '/zoom-webhook';
                    document.getElementById('calendlyUrl').textContent = baseUrl + '/calendly-webhook';
                    refreshData();
                }
                
                async function testZoom() {
                    const response = await fetch('/test-zoom', { method: 'POST' });
                    const data = await response.json();
                    alert('Zoom Test: ' + data.message);
                    refreshData();
                }
                
                async function testCalendly() {
                    const response = await fetch('/test-calendly', { method: 'POST' });
                    const data = await response.json();
                    alert('Calendly Test: ' + data.message);
                    refreshData();
                }
                
                async function refreshData() {
                    const response = await fetch('/api/stats');
                    const data = await response.json();
                    
                    document.getElementById('totalMeetings').textContent = data.total;
                    document.getElementById('activeMeetings').textContent = data.active;
                    document.getElementById('todayMeetings').textContent = data.today;
                    
                    // Tablo güncelle
                    const tbody = document.getElementById('meetingsTable');
                    if (data.meetings && data.meetings.length > 0) {
                        tbody.innerHTML = data.meetings.map(m => \`
                            <tr>
                                <td>\${new Date(m.created_at).toLocaleString('tr-TR')}</td>
                                <td>\${m.meeting_id || '-'}</td>
                                <td>\${m.host_email || '-'}</td>
                                <td>\${m.participant_name || '-'}</td>
                                <td class="\${m.status === 'completed' ? 'success' : m.status === 'started' ? 'warning' : ''}">\${m.status}</td>
                            </tr>
                        \`).join('');
                    }
                }
                
                // Her 30 saniyede bir otomatik yenile
                setInterval(refreshData, 30000);
            </script>
        </body>
        </html>
    `);
});

// Zoom Webhook Endpoint
app.post('/zoom-webhook', (req, res) => {
    console.log('📹 Zoom webhook geldi:', req.body);
    
    const { event, payload } = req.body;
    
    if (event === 'meeting.started') {
        const meeting = payload.object;
        db.run(
            `INSERT INTO meetings (meeting_id, host_email, status, start_time) VALUES (?, ?, 'started', datetime('now'))`,
            [meeting.id, meeting.host_email]
        );
        console.log(`✅ Toplantı başladı: ${meeting.id}`);
    }
    
    if (event === 'meeting.participant_joined') {
        const { id } = payload.object;
        const participant = payload.object.participant;
        
        db.run(
            `UPDATE meetings SET participant_name = ?, status = 'in_progress' WHERE meeting_id = ?`,
            [participant.user_name, id]
        );
        console.log(`👤 Katılımcı katıldı: ${participant.user_name}`);
    }
    
    if (event === 'meeting.ended') {
        const { id } = payload.object;
        db.run(
            `UPDATE meetings SET status = 'completed' WHERE meeting_id = ?`,
            [id]
        );
        console.log(`🔴 Toplantı bitti: ${id}`);
    }
    
    res.status(200).json({ status: 'ok' });
});

// Calendly Webhook Endpoint
app.post('/calendly-webhook', (req, res) => {
    console.log('📅 Calendly webhook geldi:', req.body);
    
    const { event, payload } = req.body;
    
    if (event === 'invitee.created') {
        const eventData = payload.event;
        const invitee = payload.invitee;
        
        db.run(
            `INSERT INTO meetings (meeting_id, host_email, participant_name, status) VALUES (?, ?, ?, 'scheduled')`,
            [eventData.uuid, eventData.email, invitee.name]
        );
        console.log(`📅 Yeni randevu: ${invitee.name}`);
    }
    
    res.status(200).json({ status: 'ok' });
});

// Test endpoint - Zoom
app.post('/test-zoom', (req, res) => {
    const testData = {
        event: 'meeting.started',
        payload: {
            object: {
                id: 'TEST-' + Date.now(),
                host_email: 'test@example.com'
            }
        }
    };
    
    db.run(
        `INSERT INTO meetings (meeting_id, host_email, status, start_time) VALUES (?, ?, 'started', datetime('now'))`,
        [testData.payload.object.id, testData.payload.object.host_email]
    );
    
    res.json({ message: 'Test toplantı eklendi!', meeting_id: testData.payload.object.id });
});

// Test endpoint - Calendly
app.post('/test-calendly', (req, res) => {
    const testData = {
        meeting_id: 'CAL-' + Date.now(),
        host_email: 'host@test.com',
        participant_name: 'Test Katılımcı',
        status: 'scheduled'
    };
    
    db.run(
        `INSERT INTO meetings (meeting_id, host_email, participant_name, status) VALUES (?, ?, ?, ?)`,
        Object.values(testData)
    );
    
    res.json({ message: 'Test randevu eklendi!', ...testData });
});

// API - İstatistikler
app.get('/api/stats', (req, res) => {
    db.all(`SELECT * FROM meetings ORDER BY created_at DESC LIMIT 10`, [], (err, meetings) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        db.get(`SELECT COUNT(*) as total FROM meetings`, [], (err, totalRow) => {
            db.get(`SELECT COUNT(*) as active FROM meetings WHERE status IN ('started', 'in_progress')`, [], (err, activeRow) => {
                db.get(`SELECT COUNT(*) as today FROM meetings WHERE DATE(created_at) = DATE('now')`, [], (err, todayRow) => {
                    res.json({
                        total: totalRow ? totalRow.total : 0,
                        active: activeRow ? activeRow.active : 0,
                        today: todayRow ? todayRow.today : 0,
                        meetings: meetings || []
                    });
                });
            });
        });
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Server başlat
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║                                                ║
║     🚀 TOPLANTI TAKİP SİSTEMİ BAŞLATILDI      ║
║                                                ║
╠════════════════════════════════════════════════╣
║                                                ║
║     Port: ${PORT}                              ║
║     Dashboard: http://localhost:${PORT}         ║
║                                                ║
║     Webhook Endpoints:                        ║
║     - /zoom-webhook                           ║
║     - /calendly-webhook                       ║
║                                                ║
║     Status: ✅ HAZIR                          ║
║                                                ║
╚════════════════════════════════════════════════╝
    `);
});
