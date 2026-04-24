import { LuGlobe } from 'react-icons/lu';
import { FaInstagram, FaFacebook, FaYoutube } from 'react-icons/fa6';
import korpalaLogoWide from '../assets/korpala_logo_speleologi.png';

const socials = [
  { label: 'Website',   href: 'http://www.korpala.org/',                          icon: LuGlobe },
  { label: 'Instagram', href: 'https://www.instagram.com/korpala_unhas/',          icon: FaInstagram },
  { label: 'Facebook',  href: 'https://www.facebook.com/profile.php?id=100094698523627', icon: FaFacebook },
  { label: 'YouTube',   href: 'https://www.youtube.com/@korpalaunhas',             icon: FaYoutube },
];

export function Footer() {
  return (
    <footer className="mt-auto pt-12 pb-2 border-t border-[#1c1c1c] flex flex-col items-center gap-4">
      <img
        src={korpalaLogoWide}
        alt="Korpala Speleologi"
        className="h-14 w-auto max-w-[180px] opacity-35 hover:opacity-100 transition-opacity"
      />
      <div className="flex items-center gap-4">
        {socials.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="text-[#383838] hover:text-[#808080] transition-colors"
          >
            <Icon className="w-4 h-4" />
          </a>
        ))}
      </div>
      <p className="text-[#2a2a2a] text-xs tracking-wider m-0">
        &copy; {new Date().getFullYear()} Korpala Universitas Hasanuddin
      </p>
    </footer>
  );
}
