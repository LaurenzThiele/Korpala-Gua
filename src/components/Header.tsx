import { Link } from 'react-router-dom';
import { LuArrowLeft } from 'react-icons/lu';
import korpalaLogo from '../assets/korpala_logo.png';

interface HeaderProps {
  showBack?: boolean;
  right?: React.ReactNode;
}

export function Header({ showBack, right }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-4 mb-10 border-b border-[#1c1c1c]">
      {showBack ? (
        <Link to="/" className="group flex items-center gap-3 no-underline">
          <img
            src={korpalaLogo}
            alt="Korpala"
            className="h-9 w-auto opacity-60 group-hover:opacity-90 transition-opacity"
          />
          <div className="flex flex-col leading-tight">
            <span
              className="flex items-center gap-1 text-[10px] md:text-[12px] uppercase tracking-[3px] text-brand-red leading-none"
              style={{ fontFamily: "'Fjalla One', sans-serif" }}
            >
              <LuArrowLeft className="w-3 h-3" />
              Kembali
            </span>
            <span
              className="text-xs uppercase tracking-wider text-[#606060] group-hover:text-[#909090] transition-colors leading-none mt-0.5"
              style={{ fontFamily: "'Fjalla One', sans-serif" }}
            >
              Korpala Unhas
            </span>
          </div>
        </Link>
      ) : (
        <Link to="/" className="group flex items-center gap-3 no-underline">
          <img src={korpalaLogo} alt="Korpala" className="h-9 w-auto" />
          <div className="flex flex-col leading-tight">
            <span
              className="text-[10px] md:text-[12px] uppercase tracking-[3px] text-brand-red leading-none"
              style={{ fontFamily: "'Fjalla One', sans-serif" }}
            >
              Korpala Unhas
            </span>
            <span
              className="text-xs uppercase tracking-wider text-[#505050] group-hover:text-[#808080] transition-colors leading-none mt-0.5"
              style={{ fontFamily: "'Fjalla One', sans-serif" }}
            >
              Database Gua
            </span>
          </div>
        </Link>
      )}

      {right && <div>{right}</div>}
    </header>
  );
}
