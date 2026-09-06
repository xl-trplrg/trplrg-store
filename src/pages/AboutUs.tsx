import LegalPage from '../components/LegalPage';
import { usePageMeta } from '../hooks/usePageMeta';

export default function AboutUs() {
  usePageMeta({
    title: 'Chi siamo',
    description: 'XL è rapper/producer italiano, autore dell\'album di debutto "Troppo Largo", da indipendente.',
    robots: 'noindex, follow',
  });

  return (
    <LegalPage title="Chi siamo">
      <p>
        XL è RAPPER/PRODUCER italiano. "Troppo Largo" è il suo album di debutto da
        solista: quattordici tracce da indipendente. XL proviene da Pescara, anno 98.
      </p>
      <p>
        trplrg.com è il canale ufficiale del progetto, il solo punto di riferimento per
        l'acquisto del merchandising legato all'album.
      </p>
      <p>
        Il nome dell'album, "Troppo Largo" non è solamente un modo di rappresentare se
        stesso bensì è un progetto legato alla comunità che XL rappresenta, e
        all'attitudine con cui si affronta la realtà.
      </p>
      <p>
        Per qualsiasi domanda sul progetto, sull'album o sugli ordini, la pagina{' '}
        <a href="/recapiti">Recapiti</a> riporta il contatto diretto. Aggiornamenti e
        contenuti extra vengono pubblicati sul profilo{' '}
        <a href="https://instagram.com/trplrg" target="_blank" rel="noopener noreferrer">
          Instagram ufficiale
        </a>.
      </p>
    </LegalPage>
  );
}
