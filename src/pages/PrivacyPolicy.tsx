import LegalPage from '../components/LegalPage';

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Informativa sulla privacy">
      <p><em>Ultimo aggiornamento: 17 agosto 2026</em></p>

      <p>
        Il sito trplrg.com è gestito dall'artista XL come attività occasionale per la promozione
        e vendita di merchandise relativo all'album "Troppo Largo". Questa Informativa descrive
        come vengono raccolti, utilizzati e protetti i dati personali quando visiti il sito,
        effettui un acquisto o comunichi con me.
      </p>

      <h2>Dati personali raccolti</h2>
      <p>Quando effettui un ordine o comunichi con me, posso raccogliere:</p>
      <ul>
        <li>Dati di contatto: nome, cognome, indirizzo di spedizione, indirizzo di fatturazione, numero di telefono, indirizzo email</li>
        <li>Dati di pagamento: gestiti esclusivamente da PayPal e Stripe (non ho accesso ai dati completi della carta)</li>
        <li>Dati della transazione: articoli acquistati, importo, data dell'ordine</li>
        <li>Dati tecnici: indirizzo IP, tipo di browser, dispositivo utilizzato (tramite cookie basilari)</li>
      </ul>

      <h2>Come utilizzo i tuoi dati</h2>
      <p>Utilizzo i dati esclusivamente per:</p>
      <ul>
        <li>Evadere e spedire gli ordini di merchandise</li>
        <li>Gestire i pagamenti tramite PayPal e Stripe</li>
        <li>Organizzare la spedizione con Bartolini</li>
        <li>Comunicare in merito allo stato dell'ordine</li>
        <li>Adempiere agli obblighi fiscali relativi all'attività occasionale</li>
      </ul>

      <h2>Condivisione con terzi</h2>
      <p>Per completare il tuo ordine, condivido i dati necessari con:</p>
      <ul>
        <li>PayPal e Stripe (elaborazione pagamenti)</li>
        <li>Bartolini (spedizione e consegna)</li>
      </ul>
      <p>
        Questi servizi gestiscono autonomamente i dati secondo le loro privacy policy.
        Non vendo né condivido i dati per marketing con altri soggetti.
      </p>

      <h2>Cookie</h2>
      <p>
        Il sito utilizza solo cookie tecnici basilari necessari al funzionamento e alla
        sicurezza. Non utilizzo cookie di profilazione o tracciamento marketing.
      </p>

      <h2>Conservazione dei dati</h2>
      <p>
        I dati vengono conservati per il tempo necessario all'evasione degli ordini e per
        l'adempimento degli obblighi fiscali dell'attività occasionale (10 anni per normativa
        fiscale italiana), dopodiché eliminati. Il sito trplrg.com rimarrà attivo per la durata
        della campagna promozionale dell'album (massimo 12 mesi), dopodiché verrà disattivato.
      </p>

      <h2>I tuoi diritti</h2>
      <p>Hai diritto a:</p>
      <ul>
        <li>Accedere ai tuoi dati</li>
        <li>Richiederne la rettifica o cancellazione (salvo obblighi di legge)</li>
        <li>Opporti al trattamento</li>
        <li>Ricevere i dati in formato portabile</li>
        <li>Proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it)</li>
      </ul>
      <p>Per esercitare questi diritti, scrivi a: trplrg.support@protonmail.com</p>

      <h2>Sicurezza</h2>
      <p>
        Adotto misure di sicurezza standard per proteggere i dati durante la trasmissione.
        I pagamenti sono gestiti su server sicuri di PayPal/Stripe.
      </p>

      <h2>Contatti</h2>
      <p>
        Per domande su questa Informativa o sui tuoi dati:<br />
        Email: trplrg.support@protonmail.com<br />
        Titolare del trattamento: XL (attività occasionale)
      </p>
    </LegalPage>
  );
}
