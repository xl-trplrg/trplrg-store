import './Account.css';

export default function Account() {
  return (
    <div className="account container">
      <h1 className="account__title">Account clienti</h1>
      <p className="account__toggle" style={{ marginTop: '1rem' }}>
        Questa funzione è in arrivo. Per ora ogni acquisto è "ospite": non serve
        nessun account per comprare, e riceverai comunque la ricevuta via email.
      </p>
    </div>
  );
}
