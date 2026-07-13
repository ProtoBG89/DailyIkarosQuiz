// MiZa 13.07.2026
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const EMPFAENGER_EMAIL = "982znm@gmail.com"; 

// Ermittelt das aktuelle Datum verlässlich basierend auf der Berliner Zeitzone (YYYY-MM-DD)
function getFormattedDate() {
    const d = new Date();
    const options = { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('de-DE', options).formatToParts(d);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

// Lädt die Quiz-Datenbank relativ zur Vercel-Serverless-Umgebung
function getQuizData() {
    const filePath = path.join(__dirname, 'quiz-data.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

// Nutzt die exakten Umgebungsvariablen aus der Vercel-Supabase-Integration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// Hilfsfunktion zur internen Kommunikation mit Supabase über die REST-API
async function supabaseRequest(endpoint, method = 'GET', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);
    const res = await fetch(url, config);
    return res.json();
}

export default async function handler(req, res) {
    // Sichere Passwort-Validierung (Einheitlich über Header)
    const clientPassword = req.headers['x-quiz-password'] || req.body?.password;
    const masterPassword = process.env.QUIZ_PASSWORD;

    if (!masterPassword) {
        return res.status(500).json({ message: 'Konfigurationsfehler: QUIZ_PASSWORD ist in Vercel nicht gesetzt.' });
    }

    if (!clientPassword || clientPassword !== masterPassword) {
        return res.status(401).json({ message: 'Schade! Falsches oder fehlendes Passwort. Zugriff verweigert.' });
    }

    // Verwende die Berliner Zeitzone für die Ermittlung des heutigen Tages
    const todayStr = getFormattedDate();
    let quizData;
    
    try {
        quizData = getQuizData();
    } catch (err) {
        return res.status(500).json({ message: 'Fehler beim Laden der quiz-data.json Datei.' });
    }

    const todaysQuiz = quizData[todayStr];

    if (!todaysQuiz) {
        if (req.method === 'GET') {
            return res.status(200).json({ 
                title: "🏁 Sendepause", 
                question: `Für heute (${todayStr}) ist kein IKAROS-Rätsel hinterlegt.` 
            });
        }
        return res.status(404).json({ message: `Für heute (${todayStr}) existiert kein Rätsel.` });
    }

    // --- FALL 1: Challenge & globale Highscores aus Supabase laden (GET) ---
    if (req.method === 'GET') {
        try {
            const users = await supabaseRequest('quiz_scores?select=name,points');
            const scoresObj = {};
            
            if (Array.isArray(users)) {
                users.forEach(u => { scoresObj[u.name] = u.points; });
            }

            return res.status(200).json({
                title: todaysQuiz.title,
                question: todaysQuiz.question,
                scores: scoresObj // Schickt die Live-Punkte an das Frontend mit
            });
        } catch (dbError) {
            return res.status(200).json({
                title: todaysQuiz.title,
                question: todaysQuiz.question,
                scores: {}
            });
        }
    }

    // --- FALL 2: Antwort auswerten und Punkte vergeben (POST) ---
    if (req.method === 'POST') {
        const { name, answer } = req.body;

        if (!name || !answer) {
            return res.status(400).json({ message: 'Name und Antwort fehlen.' });
        }

        const cleanAnswer = answer.trim();
        const expectedSolution = todaysQuiz.solution.trim();

        if (cleanAnswer === expectedSolution) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            
            try {
                // Spielerdaten live aus Supabase holen
                const userData = await supabaseRequest(`quiz_scores?name=eq.${name}`);
                const user = Array.isArray(userData) ? userData[0] : null;

                // Da last_solved in der DB ein DATE ist, liefert Postgres einen ISO-String (YYYY-MM-DD)
                if (user && user.last_solved === todayStr) {
                    // --- ERNEUTE RICHTIGE ANTWORT AM SELBEN TAG (BLOCKIEREN + HUMOR) ---
                    try {
                        await resend.emails.send({
                            from: 'Quiz-Bot <onboarding@resend.dev>',
                            to: EMPFAENGER_EMAIL,
                            subject: `🛡️ Hacking-Alarm: ${name} schlägt wieder zu!`,
                            html: `
                                <div style="font-family: -apple-system, sans-serif; padding: 20px; color: #1d1d1f;">
                                    <h2 style="color: #ff9500;">🛡️ Systemwarnung: Doppelter Count blockiert</h2>
                                    <p><strong>${name}</strong> hat versucht, die heutige Challenge (${todayStr}) ein weiteres Mal einzureichen.</p>
                                    <p><em>Status: Hacking-Versuch abgelehnt. Das System hat bereits eine richtige Antwort heute erkannt... Nice try, ${name}! 😉</em></p>
                                    <hr style="border: none; border-top: 1px solid #d2d2d7; margin: 20px 0;" />
                                    <p style="font-size: 13px; color: #86868b; text-transform: uppercase; margin-bottom: 4px;">Eingabe:</p>
                                    <pre style="background: #fff3cd; padding: 12px; border-radius: 8px; font-size: 14px; color: #664d03;"><code>${cleanAnswer}</code></pre>
                                </div>
                            `
                        });
                    } catch (mailErr) {}

                    return res.status(200).json({ 
                        message: `🛡️ Hacking-Versuch abgelehnt! Das System hat für heute bereits eine richtige Antwort von dir registriert... Nice try, ${name}! 😉` 
                    });
                }

                // --- ERSTE RICHTIGE ANTWORT DES TAGES (PUNKT GEBEN) ---
                const nextPoints = (user ? user.points : 0) + 1;
                
                // Supabase Update ausführen
                await supabaseRequest(`quiz_scores?name=eq.${name}`, 'PATCH', {
                    points: nextPoints,
                    last_solved: todayStr
                });

                // Reguläre Erfolgs-Mail senden
                try {
                    await resend.emails.send({
                        from: 'Quiz-Bot <onboarding@resend.dev>',
                        to: EMPFAENGER_EMAIL,
                        subject: `🏆 Quiz gelöst von ${name}!`,
                        html: `
                            <div style="font-family: -apple-system, sans-serif; padding: 20px; color: #1d1d1f;">
                                <h2 style="color: #34c759;">🎉 Challenge erfolgreich bezwungen!</h2>
                                <p><strong>${name}</strong> hat das IKAROS-Daily-Quiz am <strong>${todayStr}</strong> gelöst.</p>
                                <p><em>Punkt gewertet: Ja ✅ (Erste Abgabe heute). Neuer Stand: ${nextPoints} Punkte.</em></p>
                                <hr style="border: none; border-top: 1px solid #d2d2d7; margin: 20px 0;" />
                                <p style="font-size: 13px; color: #86868b; text-transform: uppercase; margin-bottom: 4px;">Eingereichte Lösung:</p>
                                <pre style="background: #f5f5f7; padding: 12px; border-radius: 8px; font-size: 14px;"><code>${cleanAnswer}</code></pre>
                            </div>
                        `
                    });
                } catch (mailErr) {}
                
                return res.status(200).json({ message: `🎉 Absolut richtig, ${name}! Dein Punkt wurde gezählt und die E-Mail ist raus.` });

            } catch (dbError) {
                console.error("Supabase / Resend Error:", dbError);
                return res.status(500).json({ message: 'Code korrekt, aber Fehler bei der Verarbeitung im Backend.' });
            }
        } else {
            return res.status(400).json({ message: 'Leider falsch! Schau noch mal genau hin. (Hinweis: Die Eingabe ist case-sensitiv und muss mit einem Semikolon ; enden)' });
        }
    }

    return res.status(405).json({ message: 'Methode nicht erlaubt' });
}
