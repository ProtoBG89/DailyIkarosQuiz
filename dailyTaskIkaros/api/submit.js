import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const EMPFAENGER_EMAIL = "982znm@gmail.com"; 

function getFormattedDate() {
    const d = new Date();
    const options = { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('de-DE', options).formatToParts(d);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

function getQuizData() {
    const filePath = path.join(__dirname, '..', 'quiz-data.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export default async function handler(req, res) {
    // PASSWORT-SCHUTZ PRÜFEN
    // Holt das Passwort entweder aus dem Header (bei GET) oder aus dem Body (bei POST)
    const clientPassword = req.headers['x-quiz-password'] || req.body?.password;
    const masterPassword = process.env.QUIZ_PASSWORD;

    if (!clientPassword || clientPassword !== masterPassword) {
        return res.status(401).json({ message: 'Schade! Falsches oder fehlendes Passwort. Zugriff verweigert.' });
    }

    const todayStr = getFormattedDate();
    const quizData = getQuizData();
    const todaysQuiz = quizData[todayStr];

    if (!todaysQuiz) {
        return res.status(404).json({ 
            title: "🛑 Sendepause", 
            message: `Für heute (${todayStr}) ist kein Rätsel hinterlegt.` 
        });
    }

    // FALL 1: Frage laden (GET)
    if (req.method === 'GET') {
        return res.status(200).json({
            title: todaysQuiz.title,
            question: todaysQuiz.question
        });
    }

    // FALL 2: Antwort abgeben (POST)
    if (req.method === 'POST') {
        const { name, answer } = req.body;

        if (!name || !answer) {
            return res.status(400).json({ message: 'Name und Antwort fehlen.' });
        }

        if (answer.trim() === todaysQuiz.solution) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            try {
                await resend.emails.send({
                    from: 'Quiz-Bot <onboarding@resend.dev>',
                    to: EMPFAENGER_EMAIL,
                    subject: `🏆 Quiz gelöst von ${name}!`,
                    html: `<p><strong>${name}</strong> hat das Quiz am ${todayStr} gelöst!</p><p>Lösung: <code>${answer}</code></p>`
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
