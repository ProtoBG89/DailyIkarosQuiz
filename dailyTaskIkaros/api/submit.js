import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const EMPFAENGER_EMAIL = "982znm@gmail.com"; 

// Hilfsfunktion, um das aktuelle Datum im Format YYYY-MM-DD (ZentralEuropa/Berlin) zu bekommen
function getFormattedDate() {
    const d = new Date();
    // Erzwingt die deutsche Zeitzone, damit Vercel-Server (oft in USA) nicht das falsche Datum nehmen
    const options = { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('de-DE', options).formatToParts(d);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

// Hilfsfunktion, um die JSON-Daten sicher einzulesen
function getQuizData() {
    const filePath = path.join(process.cwd(), 'quiz-data.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

export default async function handler(req, res) {
    const todayStr = getFormattedDate();
    const quizData = getQuizData();
    const todaysQuiz = quizData[todayStr];

    // Falls für den heutigen Tag kein Rätsel eingetragen ist
    if (!todaysQuiz) {
        return res.status(404).json({ 
            title: "🛑 Sendepause", 
            message: `Für das heutige Datum (${todayStr}) wurde noch kein IT-Rätsel im System hinterlegt. Chef bescheid geben!` 
        });
    }

    // FALL 1: Die Webseite fordert die Frage an (GET-Request)
    if (req.method === 'GET') {
        return res.status(200).json({
            title: todaysQuiz.title,
            question: todaysQuiz.question
            // Die "solution" wird hier natürlich NICHT mitgesendet, damit niemand im Browser spicken kann!
        });
    }

    // FALL 2: Ein Kollege schickt eine Antwort ab (POST-Request)
    if (req.method === 'POST') {
        const { name, answer } = req.body;

        if (!name || !answer) {
            return res.status(400).json({ message: 'Name und Antwort fehlen.' });
        }

        // Abgleich mit der Lösung aus dem JSON-File für den heutigen Tag
        if (answer.trim() === todaysQuiz.solution) {
            const resend = new Resend(process.env.RESEND_API_KEY);

            try {
                await resend.emails.send({
                    from: 'Quiz-Bot <onboarding@resend.dev>',
                    to: EMPFAENGER_EMAIL,
                    subject: `🏆 Quiz gelöst von ${name}!`,
                    html: `<p><strong>${name}</strong> hat das Daily Quiz am ${todayStr} erfolgreich gelöst!</p><p>Eingegebene Lösung: <code>${answer}</code></p>`
                });

                return res.status(200).json({ message: 'Absolut richtig! Die IT-Götter sind stolz auf dich. Benachrichtigung wurde an den Lead gesendet!' });
            } catch (error) {
                return res.status(500).json({ message: 'Code ist korrekt, aber E-Mail-Versand fehlgeschlagen.' });
            }
        } else {
            return res.status(400).json({ message: 'Leider falsch! Achte penibel auf Groß-/Kleinschreibung und das Semikolon am Ende.' });
        }
    }

    return res.status(405).json({ message: 'Methode nicht erlaubt' });
}
