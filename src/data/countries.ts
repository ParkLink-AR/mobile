export interface Country {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
}

// Curada, no las 195 -- Argentina primero (default de la app), después Latam,
// después el resto de los países con más probabilidad de uso.
export const COUNTRIES: Country[] = [
  { iso2: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { iso2: 'BR', name: 'Brasil', dialCode: '+55', flag: '🇧🇷' },
  { iso2: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { iso2: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾' },
  { iso2: 'PY', name: 'Paraguay', dialCode: '+595', flag: '🇵🇾' },
  { iso2: 'BO', name: 'Bolivia', dialCode: '+591', flag: '🇧🇴' },
  { iso2: 'PE', name: 'Perú', dialCode: '+51', flag: '🇵🇪' },
  { iso2: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { iso2: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨' },
  { iso2: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪' },
  { iso2: 'MX', name: 'México', dialCode: '+52', flag: '🇲🇽' },
  { iso2: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷' },
  { iso2: 'PA', name: 'Panamá', dialCode: '+507', flag: '🇵🇦' },
  { iso2: 'GT', name: 'Guatemala', dialCode: '+502', flag: '🇬🇹' },
  { iso2: 'HN', name: 'Honduras', dialCode: '+504', flag: '🇭🇳' },
  { iso2: 'SV', name: 'El Salvador', dialCode: '+503', flag: '🇸🇻' },
  { iso2: 'NI', name: 'Nicaragua', dialCode: '+505', flag: '🇳🇮' },
  { iso2: 'DO', name: 'República Dominicana', dialCode: '+1809', flag: '🇩🇴' },
  { iso2: 'CU', name: 'Cuba', dialCode: '+53', flag: '🇨🇺' },
  { iso2: 'PR', name: 'Puerto Rico', dialCode: '+1787', flag: '🇵🇷' },
  { iso2: 'US', name: 'Estados Unidos', dialCode: '+1', flag: '🇺🇸' },
  { iso2: 'CA', name: 'Canadá', dialCode: '+1', flag: '🇨🇦' },
  { iso2: 'ES', name: 'España', dialCode: '+34', flag: '🇪🇸' },
  { iso2: 'FR', name: 'Francia', dialCode: '+33', flag: '🇫🇷' },
  { iso2: 'DE', name: 'Alemania', dialCode: '+49', flag: '🇩🇪' },
  { iso2: 'IT', name: 'Italia', dialCode: '+39', flag: '🇮🇹' },
  { iso2: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { iso2: 'GB', name: 'Reino Unido', dialCode: '+44', flag: '🇬🇧' },
  { iso2: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { iso2: 'JP', name: 'Japón', dialCode: '+81', flag: '🇯🇵' },
  { iso2: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { iso2: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];
