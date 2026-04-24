import { useEffect, useRef, useState } from 'react';

interface FilePreviewProps {
  url?: string;
  file?: File;
  ext?: string;
}

export function FilePreview({ url, file, ext }: FilePreviewProps) {
  const objectUrlRef = useRef<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolvedExt, setResolvedExt] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const objUrl = URL.createObjectURL(file);
      objectUrlRef.current = objUrl;
      setResolvedUrl(objUrl);
      setResolvedExt(file.name.split('.').pop()?.toLowerCase() ?? null);
    } else if (url) {
      setResolvedUrl(url);
      setResolvedExt(ext?.toLowerCase() ?? null);
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [url, file, ext]);

  if (!resolvedUrl || !resolvedExt) return null;

  const isImage = ['png', 'jpg', 'jpeg'].includes(resolvedExt);
  const isPdf = resolvedExt === 'pdf';
  const isHtml = resolvedExt === 'html';

  if (isImage) {
    return (
      <div className="flex justify-center">
        <img
          src={resolvedUrl}
          alt="Cave preview"
          className="max-w-full max-h-[70vh] w-auto h-auto rounded-lg block"
        />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="flex justify-center w-full">
        <object
          data={resolvedUrl}
          type="application/pdf"
          className="w-full rounded-lg"
          style={{ minHeight: '500px', maxHeight: '70vh' }}
        >
          <p className="text-white text-center py-4">
            PDF tidak dapat ditampilkan.{' '}
            <a href={resolvedUrl} className="text-brand-yellow" target="_blank" rel="noreferrer">
              Buka PDF
            </a>
          </p>
        </object>
      </div>
    );
  }

  if (isHtml) {
    return <HtmlPreview url={resolvedUrl} file={file} />;
  }

  return null;
}

function HtmlPreview({ url, file }: { url: string; file?: File }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      let content: string;
      if (file) {
        content = await file.text();
      } else {
        const res = await fetch(url);
        if (!res.ok) return;
        content = await res.text();
      }

      const base = (() => {
        try {
          const u = new URL(url);
          return u.origin + u.pathname.substring(0, u.pathname.lastIndexOf('/') + 1);
        } catch {
          return window.location.origin + '/';
        }
      })();

      if (!/<base\s+[^>]*>/i.test(content)) {
        if (/<\/head>/i.test(content)) {
          content = content.replace(/<\/head>/i, `<base href="${base}"></head>`);
        } else {
          content = `<base href="${base}">${content}`;
        }
      }

      setHtml(content);
    }

    load().catch(() => setHtml(null));
  }, [url, file]);

  if (!html) return null;

  return (
    <div className="flex justify-center">
      <iframe
        srcDoc={html}
        scrolling="no"
        className="max-w-full rounded-lg bg-white border-0"
        style={{ opacity: 0, minHeight: '450px' }}
        onLoad={e => {
          const iframe = e.currentTarget;
          try {
            const doc = iframe.contentDocument!;
            const h = Math.max(Math.min(doc.body.scrollHeight, window.innerHeight * 0.7), 450);
            iframe.style.height = h + 'px';
            iframe.style.width =
              Math.min(iframe.parentElement!.clientWidth, h * (16 / 9)) + 'px';
          } catch {
            iframe.style.height = '450px';
            iframe.style.width = '100%';
          }
          iframe.style.opacity = '1';
        }}
      />
    </div>
  );
}
