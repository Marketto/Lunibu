import React from 'react';

export const EB_TEXT = {
  it: { msg: 'Impossibile caricare questa sezione. Controlla la connessione e riprova.', retry: 'Riprova' },
  ru: { msg: 'Не удалось загрузить раздел. Проверьте подключение и попробуйте снова.', retry: 'Повторить' },
  en: { msg: "Couldn't load this section. Check your connection and try again.", retry: 'Retry' }
};

/** Intercetta gli errori di caricamento dei chunk lazy e offre di ricaricare la pagina. */
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error(err); } // eslint-disable-line no-console
  render() {
    if (!this.state.failed) return this.props.children;
    const x = EB_TEXT[this.props.lang] || EB_TEXT.it;
    return (
      <div role="alert" className="small" style={{ padding: 24, textAlign: 'center' }}>
        <p>{x.msg}</p>
        <button className="btn primary" onClick={() => window.location.reload()}>{x.retry}</button>
      </div>
    );
  }
}
