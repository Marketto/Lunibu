import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import qrcode from 'qrcode-generator';
import { tap } from './Common.jsx';
import { localDate } from '../lib/util.js';
import { LOCALE } from '../lib/i18n.js';
import { appUrl } from './Share.jsx';
import { driveEnabled, fileLink, getToken, pickFile, share, revoke, transport } from '../lib/drive.js';
import { getDrive, setDrive, subscribe, hasPass, savePass, clearPass, forget, runSync, migrateLegacyPass, AUTO_MS } from '../lib/driveStore.js';
import * as ks from '../lib/keystore.js';
import { createRemote } from '../lib/driveSync.js';
import { MIN_PASS, COLLECTIONS, syncShape, exportEncrypted, importEncrypted, mergeData, buildQuickPayload, encodeQr, decodeQr } from '../lib/sync.js';

export const TX = {
  it: {
    qrAlt: 'Codice QR',
    title: 'Condividi i dati con l\'altro genitore', intro: 'Crea un file protetto da una frase segreta e invialo all\'altro genitore: i dati di crescita e medicine si uniscono sui due telefoni, senza server.',
    create: 'Crea file da inviare', open: 'Apri file ricevuto', qr: 'Mostra QR (ultimi aggiornamenti)',
    privacy: 'Il file contiene dati sanitari. È protetto dalla frase segreta e non viene salvato da nessun\'altra parte: lo conservi e lo inoltri solo tu.',
    pass: 'Frase segreta', pass2: 'Ripeti la frase segreta', hint: `Almeno ${MIN_PASS} caratteri. Concordatela a voce e non mandatela nella stessa chat del file.`,
    short: `La frase deve avere almeno ${MIN_PASS} caratteri.`, mismatch: 'Le due frasi non coincidono.',
    go: 'Continua', cancel: 'Annulla', close: 'Chiudi', busy: 'Un momento…',
    shared: 'File pronto.', downloaded: 'File scaricato: invialo all\'altro genitore.',
    pick: 'Scegli il file .lunibu ricevuto', askPass: 'Frase segreta concordata', decrypt: 'Apri e unisci',
    badPass: 'Frase segreta sbagliata, oppure il file è stato modificato.', badFile: 'Questo non è un file Lunibù valido.', fail: 'Operazione non riuscita.',
    result: (g, m, u) => `Aggiunte ${g} misure e ${m} medicine; ${u} aggiornate.`,
    received: (g, m, u) => `Ricevute dall'altro telefono: ${g} misure e ${m} medicine${u ? `, ${u} aggiornate` : ''}.`,
    sent: (g, m, p) => `Inviate da questo telefono: ${g} misure e ${m} medicine${p ? `, ${p} schemi` : ''}.`,
    inSync: 'Tutto già allineato tra i due telefoni.',
    doses: 'Dosi date dall\'altro genitore nelle ultime 24 ore', dosesNote: 'Controlla prima di dare un\'altra dose: non darla due volte.',
    qrHow: 'L\'altro genitore inquadra il QR con la normale fotocamera del telefono: si apre Lunibù e chiede la frase segreta.',
    qrBig: 'Troppi dati per un QR: usa il file.', qrMeds: 'Includi solo le medicine delle ultime 48 ore',
    qrNote: 'Contiene solo gli ultimi aggiornamenti (48 ore) ed è cifrato; i dati stanno nel link, che non viene inviato a nessun server.',
    recvTitle: 'Aggiornamento dall\'altro genitore', recvIntro: 'Hai aperto un QR di Lunibù. Inserisci la frase segreta concordata per unire i dati.',
    dTitle: 'Sincronizzazione con Google Drive', dConnect: 'Collega Google Drive', dCreate: 'Crea file di sincronizzazione', dPick: 'Usa il file ricevuto dall\'altro genitore',
    dFileName: 'Lunibù – sincronizzazione.lunibu', dShareBtn: 'Condividi con l\'altro genitore', dEmail: 'Email Google dell\'altro genitore', dShareGo: 'Invia invito', dShared: 'Invito inviato: l\'altro genitore ora sceglie "Usa il file ricevuto dall\'altro genitore".',
    dOpen: 'Apri il file in Drive', dLast: 'Ultima sincronizzazione', dNever: 'mai', dNow: 'Sincronizza ora', dUnlink: 'Scollega',
    dChip: 'Tocca per sincronizzare', dAuthFail: 'Accesso a Google non riuscito o annullato.', dNet: 'Rete non disponibile o Google non raggiungibile.', dConflict: 'Il file è stato modificato nel frattempo: riprova.', dNotFound: 'File non trovato su Drive.',
    dNote: 'Il file in Drive è cifrato con la tua frase segreta: Google e l\'autore dell\'app non possono leggerlo. L\'app accede solo al file creato o scelto, mai al resto del tuo Drive. La sincronizzazione è facoltativa: senza, tutto resta sul telefono.',
    pairBtn: 'Abbina l\'altro telefono', pairWarn: 'Chi vede o fotografa questo QR può leggere i dati sincronizzati. Mostralo solo all\'altro genitore, di persona.',
    pairShow: 'Mostra il QR', pairHide: 'Nascondi il QR', pairHow: 'L\'altro genitore lo inquadra con la normale fotocamera: Lunibù si apre e chiede conferma. Il link non viene inviato a nessun server.',
    pairReplace: 'Su questo telefono c\'è già una frase scelta a mano. Sostituirla con una chiave? Anche l\'altro telefono dovrà essere abbinato di nuovo; un file Drive creato con la frase resta con la vecchia frase.', pairReplaceGo: 'Sostituisci con una chiave',
    pairInTitle: 'Abbinamento con l\'altro genitore', pairInAsk: 'Usare questa chiave per sincronizzarti con l\'altro genitore?', pairInHas: 'Sostituirà la chiave o la frase già salvata su questo telefono.',
    pairInYes: 'Usa questa chiave', pairInDone: 'Fatto: questo telefono è abbinato.',
    useKey: 'Usa la chiave di questo telefono', useKeyNote: 'La chiave è salvata cifrata su questo telefono e si sblocca quando serve.', useOther: 'Usa una frase segreta', unlock: 'Sblocca', dUnlock: 'Tocca per sbloccare e sincronizzare',
    locked: 'Sblocco non riuscito o annullato.', keyBio: 'Chiave protetta dallo sblocco biometrico del telefono (passkey).', keyDev: 'Su questo telefono lo sblocco con impronta non è disponibile: la chiave è protetta dal dispositivo.',
    keyPasskey: 'Se cancelli tutti i dati, la passkey «Lunibù» resta nel gestore password del telefono: puoi eliminarla da lì.',
    rmKey: 'Rimuovi la chiave da questo telefono', rmAsk: 'Rimuovere la chiave da questo telefono? Per sincronizzare di nuovo dovrai riabbinarlo o inserire la frase.', rmYes: 'Rimuovi',
    dUpToDate: 'Già aggiornato.'
  },
  ru: {
    qrAlt: 'QR-код',
    title: 'Поделиться данными с другим родителем', intro: 'Создайте файл, защищённый секретной фразой, и отправьте другому родителю: данные о росте и лекарствах объединятся на двух телефонах, без сервера.',
    create: 'Создать файл для отправки', open: 'Открыть полученный файл', qr: 'Показать QR (последние обновления)',
    privacy: 'Файл содержит данные о здоровье. Он защищён секретной фразой и нигде больше не сохраняется: хранить и пересылать его можете только вы.',
    pass: 'Секретная фраза', pass2: 'Повторите секретную фразу', hint: `Не менее ${MIN_PASS} символов. Договоритесь устно и не отправляйте её в том же чате, что и файл.`,
    short: `Фраза должна быть не короче ${MIN_PASS} символов.`, mismatch: 'Фразы не совпадают.',
    go: 'Продолжить', cancel: 'Отмена', close: 'Закрыть', busy: 'Минутку…',
    shared: 'Файл готов.', downloaded: 'Файл скачан: отправьте его другому родителю.',
    pick: 'Выберите полученный файл .lunibu', askPass: 'Согласованная секретная фраза', decrypt: 'Открыть и объединить',
    badPass: 'Неверная секретная фраза, или файл изменён.', badFile: 'Это не корректный файл Lunibù.', fail: 'Не удалось выполнить.',
    result: (g, m, u) => `Добавлено ${g} измерений и ${m} лекарств; обновлено: ${u}.`,
    received: (g, m, u) => `Получено с другого телефона: ${g} измерений и ${m} лекарств${u ? `, обновлено: ${u}` : ''}.`,
    sent: (g, m, p) => `Отправлено с этого телефона: ${g} измерений и ${m} лекарств${p ? `, схем: ${p}` : ''}.`,
    inSync: 'Данные на двух телефонах уже совпадают.',
    doses: 'Дозы, данные другим родителем за последние 24 часа', dosesNote: 'Проверьте перед следующей дозой: не давайте её дважды.',
    qrHow: 'Другой родитель наводит обычную камеру телефона на QR: откроется Lunibù и спросит секретную фразу.',
    qrBig: 'Слишком много данных для QR: используйте файл.', qrMeds: 'Включить только лекарства за последние 48 часов',
    qrNote: 'Только последние обновления (48 часов), зашифровано; данные находятся в ссылке, которая не отправляется ни на какой сервер.',
    recvTitle: 'Обновление от другого родителя', recvIntro: 'Вы открыли QR-код Lunibù. Введите согласованную секретную фразу, чтобы объединить данные.',
    dTitle: 'Синхронизация с Google Drive', dConnect: 'Подключить Google Drive', dCreate: 'Создать файл синхронизации', dPick: 'Использовать файл от другого родителя',
    dFileName: 'Lunibù – синхронизация.lunibu', dShareBtn: 'Поделиться с другим родителем', dEmail: 'Google-почта другого родителя', dShareGo: 'Отправить приглашение', dShared: 'Приглашение отправлено: другой родитель теперь выбирает «Использовать файл от другого родителя».',
    dOpen: 'Открыть файл в Drive', dLast: 'Последняя синхронизация', dNever: 'никогда', dNow: 'Синхронизировать', dUnlink: 'Отключить',
    dChip: 'Нажмите для синхронизации', dAuthFail: 'Не удалось войти в Google или вход отменён.', dNet: 'Нет сети или Google недоступен.', dConflict: 'Файл тем временем изменён: попробуйте ещё раз.', dNotFound: 'Файл не найден в Drive.',
    dNote: 'Файл в Drive зашифрован вашей секретной фразой: Google и автор приложения не могут его прочитать. Приложение получает доступ только к созданному или выбранному файлу, но не к остальному вашему Drive. Синхронизация необязательна: без неё всё остаётся на телефоне.',
    pairBtn: 'Связать другой телефон', pairWarn: 'Тот, кто увидит или сфотографирует этот QR, сможет прочитать синхронизируемые данные. Показывайте его только другому родителю, лично.',
    pairShow: 'Показать QR', pairHide: 'Скрыть QR', pairHow: 'Другой родитель наводит на него обычную камеру: откроется Lunibù и попросит подтверждения. Ссылка не отправляется ни на какой сервер.',
    pairReplace: 'На этом телефоне уже есть фраза, выбранная вручную. Заменить её ключом? Другой телефон тоже придётся связать заново; файл в Drive, созданный с фразой, останется со старой фразой.', pairReplaceGo: 'Заменить ключом',
    pairInTitle: 'Связывание с другим родителем', pairInAsk: 'Использовать этот ключ для синхронизации с другим родителем?', pairInHas: 'Он заменит ключ или фразу, уже сохранённые на этом телефоне.',
    pairInYes: 'Использовать этот ключ', pairInDone: 'Готово: этот телефон связан.',
    useKey: 'Использовать ключ этого телефона', useKeyNote: 'Ключ хранится на этом телефоне в зашифрованном виде и разблокируется, когда нужен.', useOther: 'Использовать секретную фразу', unlock: 'Разблокировать', dUnlock: 'Нажмите, чтобы разблокировать и синхронизировать',
    locked: 'Разблокировка не удалась или отменена.', keyBio: 'Ключ защищён биометрической разблокировкой телефона (passkey).', keyDev: 'На этом телефоне разблокировка по отпечатку недоступна: ключ защищён устройством.',
    keyPasskey: 'Если удалить все данные, passkey «Lunibù» останется в менеджере паролей телефона: удалить её можно там.',
    rmKey: 'Удалить ключ с этого телефона', rmAsk: 'Удалить ключ с этого телефона? Чтобы снова синхронизироваться, нужно будет связать его заново или ввести фразу.', rmYes: 'Удалить',
    dUpToDate: 'Уже актуально.'
  },
  en: {
    qrAlt: 'QR code',
    title: 'Share your data with the other parent', intro: 'Create a file protected by a secret phrase and send it to the other parent: growth and medicine data merge on the two phones, with no server.',
    create: 'Create a file to send', open: 'Open a received file', qr: 'Show QR (latest updates)',
    privacy: 'The file contains health data. It is protected by the secret phrase and is not saved anywhere else: only you keep it and forward it.',
    pass: 'Secret phrase', pass2: 'Repeat the secret phrase', hint: `At least ${MIN_PASS} characters. Agree on it out loud and do not send it in the same chat as the file.`,
    short: `The phrase must have at least ${MIN_PASS} characters.`, mismatch: 'The two phrases do not match.',
    go: 'Continue', cancel: 'Cancel', close: 'Close', busy: 'One moment…',
    shared: 'File ready.', downloaded: 'File downloaded: send it to the other parent.',
    pick: 'Choose the .lunibu file you received', askPass: 'Agreed secret phrase', decrypt: 'Open and merge',
    badPass: 'Wrong secret phrase, or the file has been modified.', badFile: 'This is not a valid Lunibù file.', fail: 'Operation failed.',
    result: (g, m, u) => `Added ${g} measurements and ${m} medicines; ${u} updated.`,
    received: (g, m, u) => `Received from the other phone: ${g} measurements and ${m} medicines${u ? `, ${u} updated` : ''}.`,
    sent: (g, m, p) => `Sent from this phone: ${g} measurements and ${m} medicines${p ? `, ${p} plans` : ''}.`,
    inSync: 'Everything is already in sync between the two phones.',
    doses: 'Doses given by the other parent in the last 24 hours', dosesNote: 'Check before giving another dose: do not give it twice.',
    qrHow: 'The other parent scans the QR with the phone\'s normal camera: Lunibù opens and asks for the secret phrase.',
    qrBig: 'Too much data for a QR: use the file.', qrMeds: 'Include only the medicines of the last 48 hours',
    qrNote: 'It contains only the latest updates (48 hours) and is encrypted; the data is in the link, which is not sent to any server.',
    recvTitle: 'Update from the other parent', recvIntro: 'You opened a Lunibù QR. Enter the agreed secret phrase to merge the data.',
    dTitle: 'Sync with Google Drive', dConnect: 'Connect Google Drive', dCreate: 'Create sync file', dPick: 'Use the file received from the other parent',
    dFileName: 'Lunibù – sync.lunibu', dShareBtn: 'Share with the other parent', dEmail: 'Other parent\'s Google email', dShareGo: 'Send invitation', dShared: 'Invitation sent: the other parent now chooses "Use the file received from the other parent".',
    dOpen: 'Open the file in Drive', dLast: 'Last sync', dNever: 'never', dNow: 'Sync now', dUnlink: 'Disconnect',
    dChip: 'Tap to sync', dAuthFail: 'Google sign-in failed or was cancelled.', dNet: 'Network unavailable or Google unreachable.', dConflict: 'The file was modified in the meantime: try again.', dNotFound: 'File not found on Drive.',
    dNote: 'The file in Drive is encrypted with your secret phrase: Google and the app\'s author cannot read it. The app accesses only the file it created or that you chose, never the rest of your Drive. Syncing is optional: without it, everything stays on the phone.',
    pairBtn: 'Pair the other phone', pairWarn: 'Anyone who sees or photographs this QR can read the synced data. Show it only to the other parent, in person.',
    pairShow: 'Show the QR', pairHide: 'Hide the QR', pairHow: 'The other parent scans it with the normal camera: Lunibù opens and asks for confirmation. The link is not sent to any server.',
    pairReplace: 'This phone already has a hand-picked phrase. Replace it with a key? The other phone will also need to be paired again; a Drive file created with the phrase keeps the old phrase.', pairReplaceGo: 'Replace with a key',
    pairInTitle: 'Pairing with the other parent', pairInAsk: 'Use this key to sync with the other parent?', pairInHas: 'It will replace the key or phrase already saved on this phone.',
    pairInYes: 'Use this key', pairInDone: 'Done: this phone is paired.',
    useKey: 'Use this phone\'s key', useKeyNote: 'The key is saved encrypted on this phone and unlocked when needed.', useOther: 'Use a secret phrase', unlock: 'Unlock', dUnlock: 'Tap to unlock and sync',
    locked: 'Unlock failed or was cancelled.', keyBio: 'Key protected by the phone\'s biometric unlock (passkey).', keyDev: 'Fingerprint unlock is not available on this phone: the key is protected by the device.',
    keyPasskey: 'If you delete all data, the "Lunibù" passkey stays in the phone\'s password manager: you can remove it there.',
    rmKey: 'Remove the key from this phone', rmAsk: 'Remove the key from this phone? To sync again you will need to pair it again or enter the phrase.', rmYes: 'Remove',
    dUpToDate: 'Already up to date.'
  }
};

const EM = { locked: 'locked', 'bad-pass': 'badPass', 'bad-file': 'badFile', auth: 'dAuthFail', network: 'dNet', conflict: 'dConflict', 'not-found': 'dNotFound' };
export const errMsg = (s, e) => s[EM[e?.message]] || (e instanceof TypeError ? s.dNet : s.fail);
export const version = () => (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '');

/** Finestra modale: Esc la chiude, il focus va al primo campo/pulsante. */
function Sheet({ labelledby, onClose, children }) {
  const ref = useRef(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('input, button, [href], select, textarea')?.focus();
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close.current?.(); } };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, []);
  return <div ref={ref} className="sync-sheet" role="dialog" aria-modal="true" aria-labelledby={labelledby}>{children}</div>;
}

export function PassForm({ s, twice, onSubmit, onCancel, busy, label }) {
  const [a, setA] = useState(''), [b, setB] = useState(''), [e, setE] = useState('');
  const submit = (ev) => {
    ev.preventDefault();
    if (a.length < MIN_PASS) return setE(s.short);
    if (twice && a !== b) return setE(s.mismatch);
    setE(''); onSubmit(a);
  };
  return (
    <form onSubmit={submit}>
      <label className="field"><span>{label || s.pass}</span>
        <input type="password" autoComplete="off" value={a} onChange={(x) => setA(x.target.value)} /></label>
      {twice && <label className="field"><span>{s.pass2}</span>
        <input type="password" autoComplete="off" value={b} onChange={(x) => setB(x.target.value)} /></label>}
      {twice && <p className="small muted">{s.hint}</p>}
      {/* contatore: si vede subito quanti caratteri mancano */}
      <p className={`small pass-count ${a.length >= MIN_PASS ? 'ok' : ''}`}>{a.length >= MIN_PASS ? '✓' : `${a.length}/${MIN_PASS}`}{twice && b && a !== b ? ` · ${s.mismatch}` : ''}</p>
      {e && <p className="small form-err" role="alert">{e}</p>}
      <div className="row"><button type="button" className="btn ghost" onClick={onCancel}>{s.cancel}</button>
        <motion.button type="submit" className="btn primary" disabled={busy || a.length < MIN_PASS || (twice && a !== b)} {...tap}>{busy ? s.busy : s.go}</motion.button></div>
    </form>
  );
}

const useKs = () => useSyncExternalStore(ks.subscribe, ks.snapshot);

/** Come PassForm, ma se c'è un segreto salvato (chiave o frase) offre di usarlo, dopo lo sblocco. */
export function AskSecret({ s, onSubmit, ...rest }) {
  useKs();
  const [manual, setManual] = useState(false);
  const [err, setErr] = useState('');
  if (!ks.hasSecret() || manual) return <PassForm s={s} onSubmit={onSubmit} {...rest} />;
  const use = async () => { setErr(''); try { onSubmit(await ks.unlock()); } catch (e) { setErr(e?.message === 'no-pass' ? s.badPass : s.locked); } };
  return (
    <div>
      <p className="small muted">{s.useKeyNote}</p>
      {err && <p className="small form-err" role="alert">{err}</p>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn ghost" onClick={rest.onCancel}>{s.cancel}</button>
        <motion.button type="button" className="btn primary" disabled={rest.busy} {...tap} onClick={use}>{rest.busy ? s.busy : s.useKey}</motion.button>
      </div>
      <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={() => setManual(true)}>{s.useOther}</button>
    </div>
  );
}

/** Una riga su come è protetta la chiave su questo telefono. */
function KeyState({ s }) {
  useKs();
  const k = ks.kind();
  if (!k) return null;
  return <p className="small muted">{k === 'prf' ? s.keyBio : s.keyDev} {s.keyPasskey}</p>;
}

/** Rimuove la chiave da questo telefono (conferma breve). */
function RemoveKey({ s }) {
  useKs();
  const [ask, setAsk] = useState(false);
  if (!ks.hasSecret()) return null;
  if (!ask) return <p><button className="btn ghost small" onClick={() => setAsk(true)}>{s.rmKey}</button></p>;
  return (
    <div className="note care" style={{ flexDirection: 'column' }} role="alert">
      <p style={{ margin: 0 }}>{s.rmAsk}</p>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn ghost" onClick={() => setAsk(false)}>{s.cancel}</button>
        <button className="btn primary" onClick={() => { ks.clear(); setAsk(false); }}>{s.rmYes}</button>
      </div>
    </div>
  );
}

/** Abbinamento: questo telefono mostra il QR con la chiave per l'altro genitore. */
function PairSection({ s }) {
  useKs();
  const [step, setStep] = useState(null); // 'warn' | 'replace' | 'show'
  const [svg, setSvg] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const show = (key) => { const q = qrcode(0, 'M'); q.addData(ks.pairLink(appUrl(), key)); q.make(); setSvg(q.createSvgTag({ cellSize: 3, margin: 2, scalable: true })); setStep('show'); };
  const close = () => { setStep(null); setSvg(''); setMsg(''); };
  const go = async (replace) => {
    setBusy(true); setMsg('');
    try {
      let key = ks.hasSecret() ? await ks.unlock() : null;
      if (key && !ks.isPairKey(key) && !replace) { setStep('replace'); setBusy(false); return; }
      if (!key || !ks.isPairKey(key)) { key = ks.newPairKey(); await ks.store(key); }
      show(key);
    } catch (e) { setMsg(errMsg(s, e)); }
    setBusy(false);
  };
  return (
    <div style={{ marginTop: 14 }}>
      {!step && <button className="btn" onClick={() => setStep('warn')}>{s.pairBtn}</button>}
      {step === 'warn' && (
        <div className="note care" style={{ flexDirection: 'column' }} role="alert">
          <p style={{ margin: 0 }}>{s.pairWarn}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={close}>{s.cancel}</button>
            <button className="btn primary" disabled={busy} onClick={() => go(false)}>{busy ? s.busy : s.pairShow}</button>
          </div>
        </div>
      )}
      {step === 'replace' && (
        <div className="note care" style={{ flexDirection: 'column' }} role="alert">
          <p style={{ margin: 0 }}>{s.pairReplace}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={close}>{s.cancel}</button>
            <button className="btn primary" disabled={busy} onClick={() => go(true)}>{s.pairReplaceGo}</button>
          </div>
        </div>
      )}
      {step === 'show' && (
        <div>
          <p className="small">{s.pairHow}</p>
          <div className="qr" role="img" aria-label={s.qrAlt} dangerouslySetInnerHTML={{ __html: svg }} />
          <button className="btn" onClick={close}>{s.pairHide}</button>
        </div>
      )}
      {msg && <p className="small" role="alert">{msg}</p>}
    </div>
  );
}

/** Conferma sull'altro telefono, aperto da #pair=<chiave>. */
export function PairReceive({ lang, secret, onClose }) {
  const s = TX[lang];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const has = ks.hasSecret();
  const yes = async () => { setBusy(true); setMsg(''); try { await ks.store(secret); setDone(true); } catch (e) { setMsg(errMsg(s, e)); } setBusy(false); };
  return (
    <Sheet labelledby="pair-h" onClose={onClose}>
      <div className="sync-sheet-in">
        <h2 id="pair-h" style={{ marginTop: 0 }}>{s.pairInTitle}</h2>
        {done ? (
          <><p role="status"><strong>{s.pairInDone}</strong></p><KeyState s={s} /><button className="btn primary" onClick={onClose}>{s.close}</button></>
        ) : (
          <>
            <p><strong>{s.pairInAsk}</strong></p>
            {has && <p className="small">{s.pairInHas}</p>}
            {msg && <p className="small form-err" role="alert">{msg}</p>}
            <div className="row"><button className="btn ghost" onClick={onClose}>{s.cancel}</button>
              <motion.button className="btn primary" disabled={busy} {...tap} onClick={yes}>{busy ? s.busy : s.pairInYes}</motion.button></div>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function SyncResult({ s, lang, stats, kids }) {
  const name = (id) => kids.find((k) => k.id === id)?.name;
  return (
    <div role="status">
      {stats.sent ? (
        <>
          {stats.addedGrowth + stats.addedMeds + stats.updated + stats.sent.growth + stats.sent.meds + stats.sent.plans === 0
            ? <p><strong>{s.inSync}</strong></p>
            : <>
              <p><strong>{s.received(stats.addedGrowth, stats.addedMeds, stats.updated)}</strong></p>
              <p><strong>{s.sent(stats.sent.growth, stats.sent.meds, stats.sent.plans)}</strong></p>
            </>}
        </>
      ) : <p><strong>{s.result(stats.addedGrowth, stats.addedMeds, stats.updated)}</strong></p>}
      {stats.recentDoses.length > 0 && (
        <div className="note care" style={{ flexDirection: 'column', marginTop: 10 }}>
          <strong>{s.doses}</strong>
          <ul className="sync-doses">
            {stats.recentDoses.map((d) => (
              <li key={d.id}>{d.name}{name(d.kidId) ? ` (${name(d.kidId)})` : ''} · {new Date(d.at).toLocaleString(LOCALE[lang], { dateStyle: 'short', timeStyle: 'short' })}</li>
            ))}
          </ul>
          <span className="small">{s.dosesNote}</span>
        </div>
      )}
    </div>
  );
}

const readState = syncShape;

export default function SyncCard({ lang, state, onMerge }) {
  const s = TX[lang];
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [qr, setQr] = useState(null); // { svg, big }
  const [qrPass, setQrPass] = useState('');
  const reset = (m) => { setMode(m); setMsg(''); setRes(null); setQr(null); setFile(null); };

  const doExport = async (pass) => {
    setBusy(true);
    try {
      const blob = await exportEncrypted(readState(state), pass, version());
      const f = new File([blob], `lunibu-${localDate()}.lunibu`, { type: 'application/octet-stream' });
      if (navigator.canShare?.({ files: [f] })) {
        try { await navigator.share({ files: [f] }); setMsg(s.shared); } catch (e) { if (e?.name !== 'AbortError') throw e; }
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000); setMsg(s.downloaded);
      }
    } catch (e) { setMsg(errMsg(s, e)); }
    setBusy(false);
  };

  const doImport = async (pass) => {
    if (!file) return setMsg(s.badFile);
    setBusy(true); setMsg('');
    try {
      const remote = await importEncrypted(file, pass);
      const m = mergeData(readState(state), remote);
      onMerge(m); setRes(m.stats);
    } catch (e) { setMsg(errMsg(s, e)); }
    setBusy(false);
  };

  const doQr = async (pass, medsOnly = false) => {
    setBusy(true); setMsg(''); setQrPass(pass);
    try {
      const payload = buildQuickPayload(readState(state), { medsOnly, appVersion: version() });
      const { data, tooLarge } = await encodeQr(payload, pass);
      if (tooLarge) setQr({ big: true, medsOnly });
      else {
        const q = qrcode(0, 'L'); q.addData(`${appUrl()}#sync=${data}`); q.make();
        setQr({ svg: q.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) });
      }
    } catch (e) { setMsg(errMsg(s, e)); }
    setBusy(false);
  };

  return (
    <section className="sync-card diary-form" aria-labelledby="sync-h" data-tour="sync">
      <h2 id="sync-h" style={{ marginTop: 0 }}>{s.title}</h2>
      <p className="small">{s.intro}</p>
      <p className="small muted">{s.privacy}</p>
      <KeyState s={s} />
      <RemoveKey s={s} />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => reset('export')}>{s.create}</button>
        <button className="btn" onClick={() => reset('import')}>{s.open}</button>
        <button className="btn" onClick={() => reset('qr')}>{s.qr}</button>
      </div>

      {mode === 'export' && <div style={{ marginTop: 12 }}><AskSecret s={s} twice busy={busy} onSubmit={doExport} onCancel={() => reset(null)} />{msg && <p role="status">{msg}</p>}</div>}

      {mode === 'import' && (
        <div style={{ marginTop: 12 }}>
          {res ? (
            <><SyncResult s={s} lang={lang} stats={res} kids={state.kids || []} /><button className="btn" style={{ marginTop: 10 }} onClick={() => reset(null)}>{s.close}</button></>
          ) : (
            <>
              <label className="field"><span>{s.pick}</span><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
              <AskSecret s={s} label={s.askPass} busy={busy} onSubmit={doImport} onCancel={() => reset(null)} />
              {msg && <p className="small" role="alert">{msg}</p>}
            </>
          )}
        </div>
      )}

      {mode === 'qr' && (
        <div style={{ marginTop: 12 }}>
          {!qr ? (
            <><AskSecret s={s} twice busy={busy} onSubmit={doQr} onCancel={() => reset(null)} />{msg && <p className="small" role="alert">{msg}</p>}</>
          ) : qr.big ? (
            <div role="alert">
              <p><strong>{s.qrBig}</strong></p>
              {!qr.medsOnly && <button className="btn" onClick={() => doQr(qrPass, true)}>{s.qrMeds}</button>}
              <button className="btn ghost" onClick={() => reset(null)}>{s.close}</button>
            </div>
          ) : (
            <>
              <p className="small">{s.qrHow}</p>
              <div className="qr" role="img" aria-label={s.qrAlt} dangerouslySetInnerHTML={{ __html: qr.svg }} />
              <p className="small muted">{s.qrNote}</p>
              <button className="btn" onClick={() => reset(null)}>{s.close}</button>
            </>
          )}
        </div>
      )}
      <PairSection s={s} />
      {driveEnabled && <DriveSection lang={lang} state={state} onMerge={onMerge} />}
    </section>
  );
}

const useDrive = () => useSyncExternalStore(subscribe, getDrive);

function DriveSection({ lang, state, onMerge }) {
  const s = TX[lang];
  const d = useDrive();
  const [linked, setLinked] = useState(false);
  const [mode, setMode] = useState(null); // 'create' | 'pick' | 'pass' | 'share'
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState(null);
  const [email, setEmail] = useState('');
  const latest = useRef(state); latest.current = state;
  const fail = (e) => { if (e?.message === 'bad-pass') { clearPass(); if (d.fileId) setMode('pass'); } setMsg(errMsg(s, e)); };
  const guard = async (f) => { setBusy(true); setMsg(''); try { await f(); } catch (e) { fail(e); } setBusy(false); };

  const connect = () => guard(async () => { await getToken(); setLinked(true); });
  const create = (pass) => guard(async () => {
    const { id } = await createRemote({ transport: transport(), name: s.dFileName, pass, local: readState(latest.current), appVersion: version() });
    setDrive({ fileId: id, lastSync: Date.now() }); await savePass(pass); setMode('share');
  });
  const pick = () => guard(async () => { const id = await pickFile(); if (id) { setPicked(id); setMode('pick'); } });
  const doSync = (fileId, pass) => guard(async () => {
    const r = await runSync({ latest: () => readState(latest.current), fileId, pass, appVersion: version() });
    onMerge(r.merged); setRes(r.stats); setMode(null);
  });
  const sendShare = (ev) => { ev.preventDefault(); guard(async () => { await share(d.fileId, email.trim()); setMsg(s.dShared); setEmail(''); }); };
  const unlink = () => guard(async () => { forget(); setLinked(false); setMode(null); setRes(null); await revoke(); });

  const connected = Boolean(d.fileId);
  const last = d.lastSync ? new Date(d.lastSync).toLocaleString(LOCALE[lang], { dateStyle: 'short', timeStyle: 'short' }) : s.dNever;

  return (
    <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px dashed var(--line, #c9c4d8)' }}>
      <h3 id="drive-h" style={{ marginTop: 0 }}>{s.dTitle}</h3>
      <p className="small muted">{s.dNote}</p>

      {!connected && !linked && <button className="btn" disabled={busy} onClick={connect}>{busy ? s.busy : s.dConnect}</button>}

      {!connected && linked && !mode && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => { setMode('create'); setMsg(''); }}>{s.dCreate}</button>
          <button className="btn" disabled={busy} onClick={pick}>{s.dPick}</button>
        </div>
      )}
      {!connected && mode === 'create' && <AskSecret s={s} twice busy={busy} onSubmit={create} onCancel={() => setMode(null)} />}
      {!connected && mode === 'pick' && <AskSecret s={s} label={s.askPass} busy={busy} onSubmit={(p) => doSync(picked, p)} onCancel={() => setMode(null)} />}

      {connected && (
        <div>
          <p className="small">{s.dLast}: <strong>{last}</strong></p>
          {mode === 'pass' ? (
            <PassForm s={s} label={s.askPass} busy={busy} onSubmit={(p) => doSync(d.fileId, p)} onCancel={() => setMode(null)} />
          ) : (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <motion.button className="btn primary" disabled={busy} {...tap} onClick={() => (hasPass() ? doSync(d.fileId) : setMode('pass'))}>{busy ? s.busy : s.dNow}</motion.button>
              <button className="btn" onClick={() => setMode(mode === 'share' ? null : 'share')}>{s.dShareBtn}</button>
              <button className="btn ghost" disabled={busy} onClick={unlink}>{s.dUnlink}</button>
            </div>
          )}
          {mode === 'share' && (
            <form onSubmit={sendShare} style={{ marginTop: 10 }}>
              <label className="field"><span>{s.dEmail}</span><input type="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <button type="submit" className="btn" disabled={busy}>{s.dShareGo}</button>
            </form>
          )}
          <p className="small" style={{ marginTop: 10 }}><a href={fileLink(d.fileId)} target="_blank" rel="noopener noreferrer">{s.dOpen}</a></p>
        </div>
      )}
      {res && <div style={{ marginTop: 10 }}><SyncResult s={s} lang={lang} stats={res} kids={state.kids || []} /></div>}
      {msg && <p className="small" role="alert">{msg}</p>}
    </div>
  );
}

/** Sincronizzazione automatica (apertura app e ritorno in primo piano). Mai finestre: se serve l'utente, mostra un chip. */
export function DriveAuto({ lang, state, onMerge }) {
  const s = TX[lang];
  const d = useDrive();
  const [needs, setNeeds] = useState(false);
  const [res, setRes] = useState(null);
  const latest = useRef(state); latest.current = state;
  const cb = useRef(); cb.current = onMerge;

  const [locked, setLocked] = useState(false);
  const [askPass, setAskPass] = useState(false);
  const [pBusy, setPBusy] = useState(false);
  const [pMsg, setPMsg] = useState('');
  const run = async (silent, pass) => {
    try {
      const r = await runSync({ latest: () => readState(latest.current), silent, pass, appVersion: version() });
      cb.current(r.merged); setNeeds(false); setLocked(false); setAskPass(false); setPMsg('');
      if (r.stats.recentDoses.length > 0) setRes(r.stats);
    } catch (e) {
      if (e?.message === 'auth') setNeeds(true);
      else if (e?.message === 'locked') setLocked(true);
      else if (e?.message === 'bad-pass') { clearPass(); setAskPass(true); setPMsg(s.badPass); }
      else if (!silent) { setAskPass(true); setPMsg(s[EM[e?.message]] || s.fail); }
    }
  };
  useEffect(() => {
    if (!driveEnabled || !d.fileId) return undefined;
    let alive = true;
    const tryAuto = () => {
      const g = getDrive();
      if (document.visibilityState !== 'visible' || !g.fileId || !hasPass() || !navigator.onLine || Date.now() - (g.lastSync || 0) <= AUTO_MS) return;
      // sblocco automatico (biometria) una sola volta per apertura dell'app; poi solo al tocco del chip
      if (!ks.isUnlocked() && !ks.takeAutoUnlock()) { setLocked(true); return; }
      run(true);
    };
    migrateLegacyPass().catch(() => {}).then(() => { if (alive) tryAuto(); });
    document.addEventListener('visibilitychange', tryAuto);
    return () => { alive = false; document.removeEventListener('visibilitychange', tryAuto); };
  }, [d.fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // dopo una modifica locale (misura, dose, import): sincronizza dopo 8 s di calma, senza rincorrersi
  const sig = (st) => JSON.stringify(COLLECTIONS.map((k) => (st[k] || []).map((x) => `${x.id}:${x.updatedAt || ''}`).sort()));
  const lastSig = useRef(null);
  const curSig = sig(state);
  useEffect(() => {
    if (!driveEnabled || !d.fileId || !ks.isUnlocked()) return undefined;
    if (lastSig.current === null) { lastSig.current = curSig; return undefined; }
    if (curSig === lastSig.current) return undefined;
    const t = setTimeout(async () => {
      if (!navigator.onLine) return;
      await run(true);
      lastSig.current = sig(latest.current);
    }, 8000);
    return () => clearTimeout(t);
  }, [curSig, d.fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!driveEnabled || !d.fileId) return null;
  return (
    <>
      {askPass && (
        <Sheet labelledby="drive-ph" onClose={() => { setAskPass(false); setPMsg(''); }}>
          <div className="sync-sheet-in">
            <h2 id="drive-ph" style={{ marginTop: 0 }}>{s.dTitle}</h2>
            {pMsg && <p className="small" role="alert">{pMsg}</p>}
            <AskSecret s={s} label={s.askPass} busy={pBusy} onSubmit={async (p) => { setPBusy(true); await run(false, p); setPBusy(false); }} onCancel={() => { setAskPass(false); setPMsg(''); }} />
          </div>
        </Sheet>
      )}
      {needs && <button className="drive-chip" onClick={() => run(false)}>{s.dChip}</button>}
      {locked && !needs && <button className="drive-chip" onClick={() => run(false)}>{s.dUnlock}</button>}
      {res && (
        <Sheet labelledby="drive-rh" onClose={() => setRes(null)}>
          <div className="sync-sheet-in">
            <h2 id="drive-rh" style={{ marginTop: 0 }}>{s.dTitle}</h2>
            <SyncResult s={s} lang={lang} stats={res} kids={state.kids || []} />
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setRes(null)}>{s.close}</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

/** Pannello che si apre quando l'app è aperta da un QR (#sync=...). */
export function QuickReceive({ lang, data, state, onMerge, onClose }) {
  const s = TX[lang];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState(null);
  const go = async (pass) => {
    setBusy(true); setMsg('');
    try {
      const m = mergeData(readState(state), await decodeQr(data, pass));
      onMerge(m); setRes(m.stats);
    } catch (e) { setMsg(errMsg(s, e)); }
    setBusy(false);
  };
  return (
    <Sheet labelledby="sync-rh" onClose={onClose}>
      <motion.div className="sync-sheet-in" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        <h2 id="sync-rh" style={{ marginTop: 0 }}>{s.recvTitle}</h2>
        {res ? (
          <><SyncResult s={s} lang={lang} stats={res} kids={state.kids || []} /><button className="btn primary" style={{ marginTop: 12 }} onClick={onClose}>{s.close}</button></>
        ) : (
          <><p className="small">{s.recvIntro}</p>
            <AskSecret s={s} label={s.askPass} busy={busy} onSubmit={go} onCancel={onClose} />
            {msg && <p className="small" role="alert">{msg}</p>}</>
        )}
      </motion.div>
    </Sheet>
  );
}
