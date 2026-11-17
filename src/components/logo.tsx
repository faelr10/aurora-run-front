import logo from '../../logo-sem-fundo.png';

export function Logo({ size = 72, label = '' }: { size?: number; label?: string }) {
  return <img className="logo-mark" src={logo} width={size} height={size} alt={label} />;
}
