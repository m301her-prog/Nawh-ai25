import {Download, Monitor} from 'lucide-react';

/**
 * زر تثبيت فرما تيك كتطبيق سطح مكتب عبر PWA.
 * لا يحتاج إلى ملف exe؛ يعمل على Windows وmacOS وLinux من Chrome أو Edge.
 */
export default function DesktopDownloadButton({onInstall, installed=false, compact=false}){
  return <button className={`desktop-download-button ${compact?'compact':''}`} type="button" onClick={onInstall} disabled={installed}>
    {compact?<Download size={15}/>:<Monitor size={17}/>} {installed?'تم تثبيت نسخة سطح المكتب':'تحميل نسخة سطح المكتب'}
  </button>;
}
