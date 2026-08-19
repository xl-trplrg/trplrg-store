import { Link } from 'react-router-dom';
import './LegalPage.css';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function LegalPage({ title, children }: Props) {
  return (
    <div className="legal-page container">
      <Link to="/" className="legal-page__back">← Torna allo shop</Link>
      <h1 className="legal-page__title">{title}</h1>
      <div className="legal-page__content">{children}</div>
    </div>
  );
}
