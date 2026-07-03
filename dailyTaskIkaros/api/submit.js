import { Resend } from 'resend';

// Hier trägst du das tägliche Lösungswort ein (alles in Kleinbuchstaben)
const RICHTIGE_ANTWORT = "myDate.getDay();"; 

// Hier den E-Mail-Verteiler deines Teams eintragen
const EMPFAENGER_EMAIL = "982znm@gmail.com"; 

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Methode nicht erlaubt' });
    }

    const { name, answer } = req.body;

    if (!name || !answer) {
        return res.status(400).json({ message: 'Name und Antwort fehlen.' });
    }

    // Abgleich (Groß-/Kleinschreibung ignorieren und Leerzeichen entfernen)
    //if (answer.trim().toLowerCase() === RICHTIGE_ANTWORT.toLowerCase()) {
      if (answer.trim() === RICHTIGE_ANTWORT.toLowerCase()) {
        // E-Mail-Versand via Resend initiieren
        const resend = new Resend(process.env.RESEND_API_KEY);

        try {
            await resend.emails.send({
                from: 'Quiz-Bot <onboarding@resend.dev>', // Kostenlose Standard-Absenderadresse
                to: EMPFAENGER_EMAIL,
                subject: `🏆 Quiz gelöst von ${name}!`,
                html: `<p>Hallo!</p><p><strong>${name}</strong> hat das Daily Quiz gerade richtig beantwortet!</p><p>Eingegebene Lösung: <em>${answer}</em></p>`
            });

            return res.status(200).json({ message: 'Absolut richtig! Die IT-Götter sind stolz auf dich. Benachrichtigung wurde an den Lead gesendet!' });
        } catch (error) {
            return res.status(500).json({ message: 'Antwort korrekt, aber E-Mail-Versand fehlgeschlagen.' });
        }
    } else {
        return res.status(400).json({ message: 'Leider falsch! Achte penibel auf Groß-/Kleinschreibung und das Semikolon am Ende.' });
    }
}
