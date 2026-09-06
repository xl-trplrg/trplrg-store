import LegalPage from '../components/LegalPage';
import { usePageMeta } from '../hooks/usePageMeta';

export default function AboutUs() {
  usePageMeta({
    title: 'Chi siamo',
    description: 'XL è un artista rap/boom bap italiano, autore dell\'album di debutto "Troppo Largo", interamente autoprodotto. Scopri la storia del progetto.',
  });

  return (
    <LegalPage title="Chi siamo">
      <p>
        XL è un artista rap/boom bap italiano. <strong>"Troppo Largo"</strong> è il suo
        album di debutto da solista: quattordici tracce scritte, registrate e prodotte
        in totale autonomia, senza etichetta discografica alle spalle.
      </p>
      <p>
        Il progetto nasce come lavoro indipendente a tutti gli effetti: dalla scrittura
        dei testi alla produzione, fino alla realizzazione di questo stesso sito, ogni
        fase è stata curata direttamente da XL. trplrg.com è il canale ufficiale del
        progetto, il solo punto di riferimento per l'acquisto del vinile, del CD e del
        merchandising legato all'album.
      </p>
      <p>
        Il nome dell'album, "Troppo Largo", richiama un'estetica precisa che si ritrova
        anche nel merch: capi con vestibilità oversize, in linea con l'immaginario
        boom bap e street a cui il disco si ispira.
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
