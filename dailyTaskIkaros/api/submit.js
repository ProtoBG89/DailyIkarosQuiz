import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const EMPFAENGER_EMAIL = "982znm@gmail.com"; 

function getFormattedDate() {
    const d = new Date();
    const options = { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('de-DE', options).formatToParts(d);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.month === 'month' || p.type === 'month').value;
    const day = parts.find(p => p.day === 'day' || p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

// Levenshtein-Distanz zur Berechnung der Text-Ähnlichkeit
function getLevenshteinDistance(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return matrix[a.length][b.length];
}

function getQuizData() {
    const filePath = path.join(__dirname, 'quiz-data.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

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
    const clientPassword = req.headers['x-quiz-password'] || req.body?.password;
    const masterPassword = process.env.QUIZ_PASSWORD;

    if (!masterPassword) {
        return res.status(500).json({ message: 'Konfigurationsfehler: QUIZ_PASSWORD ist nicht gesetzt.' });
    }

    if (!clientPassword || clientPassword !== masterPassword) {
        return res.status(401).json({ message: 'Zugriff verweigert.' });
    }

    const todayStr = getFormattedDate();
    let quizData;
    
    try {
        quizData = getQuizData();
    } catch (err) {
        return res.status(500).json({ message: 'Fehler beim Laden der Quiz-Daten.' });
    }

    const todaysQuiz = quizData[todayStr];

    if (!todaysQuiz) {
        return res.status(404).json({ message: `Für heute (${todayStr}) existiert kein Rätsel.` });
    }

    if (req.method === 'GET') {
        try {
            const users = await supabaseRequest('quiz_scores?select=name,points');
            const scoresObj = {};
            if (Array.isArray(users)) users.forEach(u => { scoresObj[u.name] = u.points; });
            
            // HINZUFÜGUNG: solution mitsenden, damit das Frontend live den Fortschritt berechnen kann
            return res.status(200).json({ 
                title: todaysQuiz.title, 
                question: todaysQuiz.question, 
                solution: todaysQuiz.solution,
                scores: scoresObj 
            });
        } catch (dbError) {
            return res.status(200).json({ 
                title: todaysQuiz.title, 
                question: todaysQuiz.question, 
                solution: todaysQuiz.solution,
                scores: {} 
            });
        }
    }

    if (req.method === 'POST') {
        const { name, answer } = req.body;
        if (!name || !answer) return res.status(400).json({ message: 'Name und Antwort fehlen.' });

        const cleanAnswer = answer.trim();
        const expectedSolution = todaysQuiz.solution.trim();
        
        const distance = getLevenshteinDistance(cleanAnswer, expectedSolution);
        const maxLength = Math.max(cleanAnswer.length, expectedSolution.length);
        const similarity = maxLength === 0 ? 0 : (1 - distance / maxLength) * 100;

        if (similarity >= 90) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            
            try {
                const userData = await supabaseRequest(`quiz_scores?name=eq.${name}`);
                const user = Array.isArray(userData) ? userData[0] : null;

                if (user && user.last_solved === todayStr) {
                    return res.status(200).json({ message: `🛡️ Hacking-Versuch abgelehnt! Du hast heute bereits gelöst.` });
                }

                const nextPoints = (user ? user.points : 0) + 1;
                await supabaseRequest(`quiz_scores?name=eq.${name}`, 'PATCH', { points: nextPoints, last_solved: todayStr });

                try {
                    await resend.emails.send({
                        from: 'Quiz-Bot <onboarding@resend.dev>',
                        to: EMPFAENGER_EMAIL,
                        subject: `🏆 Quiz gelöst: ${name}`,
                        html: `<p><strong>${name}</strong> hat gelöst. Neuer Stand: ${nextPoints} Punkte.</p>`
                    });
                } catch (mailErr) {}
                
                return res.status(200).json({ message: `🎉 Korrekt! Dein Punkt wurde gezählt.` });

            } catch (dbError) {
                return res.status(500).json({ message: 'Fehler bei der DB-Verarbeitung.' });
            }
        } else {
            return res.status(400).json({ message: `Leider falsch (Ähnlichkeit: ${Math.round(similarity)}%). Prüfe Tippfehler oder Syntax.` });
        }
    }

    return res.status(405).json({ message: 'Methode nicht erlaubt' });
}
