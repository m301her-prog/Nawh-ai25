import { useEffect, useState } from 'react';
import { Download, Monitor, ExternalLink, Check } from 'lucide-react';

const DESKTOP_APP_URL = 'https://nawh-ai25.vercel.app/';

const labels = {
  ar: {
    install: 'تثبيت نسخة سطح المكتب',
    download: 'تحميل نسخة سطح المكتب',
    installed: 'نسخة سطح المكتب مثبتة',
    open: 'فتح نسخة سطح المكتب',
  },
  fr: {
    install: 'Installer la version bureau',
    download: 'Télécharger la version bureau',
    installed: 'Version bureau installée',
    open: 'Ouvrir la version bureau',
  },
  en: {
    install: 'Install desktop version',
    download: 'Download desktop version',
    installed: 'Desktop version installed',
    open: 'Open desktop version',
  },
};

export default function DesktopDownloadButton({ language = 'ar', compact = false }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const text = labels[language] || labels.ar;

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    setInstalled(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      window.open(DESKTOP_APP_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  };

  const label = installed ? text.installed : installPrompt ? text.install : text.download;

  return (
    <div className="desktop-download-wrap">
      <button
        className={`desktop-download-button ${compact ? 'compact' : ''}`}
        type="button"
        onClick={handleInstall}
        aria-label={label}
        title={label}
      >
        {installed ? <Check size={compact ? 15 : 17} /> : installPrompt ? <Monitor size={compact ? 15 : 17} /> : <Download size={compact ? 15 : 17} />}
        <span>{label}</span>
      </button>
      {!installPrompt && !installed && (
        <a className="desktop-download-link" href={DESKTOP_APP_URL} target="_blank" rel="noreferrer">
          <ExternalLink size={13} /> {text.open}
        </a>
      )}
    </div>
  );
}

export { DESKTOP_APP_URL };
