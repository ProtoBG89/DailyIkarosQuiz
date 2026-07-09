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
    const filePath = path.join(process.cwd(), 'quiz-data.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export default async function handler(req, res) {
    // 1. Sichere Passwort-Validierung (Header bei GET, Body bei POST)
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

    // --- FALL 1: Challenge für das Frontend laden (GET) ---
    if (req.method === 'GET') {
        return res.status(200).json({
            title: todaysQuiz.title,
            question: todaysQuiz.question
        });
    }

    // --- FALL 2: Antwort auswerten und per E-Mail senden (POST) ---
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
                await resend.emails.send({
                    from: 'Quiz-Bot <onboarding@resend.dev>',
                    to: EMPFAENGER_EMAIL,
                    subject: `🏆 Quiz gelöst von ${name}!`,
                    html: `
                        <div style="font-family: -apple-system, sans-serif; padding: 20px; color: #1d1d1f;">
                            <h2 style="color: #34c759;">🎉 Challenge erfolgreich bezwungen!</h2>
                            <p><strong>${name}</strong> hat das IKAROS-Daily-Quiz am <strong>${todayStr}</strong> gelöst.</p>
                            <hr style="border: none; border-top: 1px solid #d2d2d7; margin: 20px 0;" />
                            <p style="font-size: 13px; color: #86868b; text-transform: uppercase; margin-bottom: 4px;">Eingereichte Lösung:</p>
                            <pre style="background: #f5f5f7; padding: 12px; border-radius: 8px; font-size: 14px;"><code>${cleanAnswer}</code></pre>
                        </div>
                    `
                });
                return res.status(200).json({ message: 'Absolut richtig! E-Mail ist raus.' });
            } catch (error) {
                return res.status(500).json({ message: 'Code korrekt, aber Mail-Versand fehlgeschlagen.' });
            }
        } else {
            return res.status(400).json({ message: 'Leider falsch! Schau noch mal genau hin. (Hinweis: Die Eingabe ist case-sensitiv und muss mit einem Semikolon ; enden)' });
        }
    }

    return res.status(405).json({ message: 'Methode nicht erlaubt' });
}
